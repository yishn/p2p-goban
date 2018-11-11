import {h, Component} from 'preact'
import {Goban} from '@sabaki/shudan'
import ToolBar from './ToolBar.js'

import createSwarm from 'webrtc-swarm'
import signalhub from 'signalhub'
import uuid from 'uuid/v4'
import Board from '../crdt-board.js'

export default class App extends Component {
    constructor(props) {
        super(props)

        this.hub = null

        this.state = {
            swarm: null,
            busy: true,
            sign: 1,
            board: new Board()
        }
    }

    componentDidMount() {
        let channel = location.hash.length <= 1 ? uuid() : location.hash.slice(1)
        if (location.hash.length <= 1) history.replaceState(null, '', `#${channel}`)

        this.hub = signalhub(channel, ['https://signalhub.mafintosh.com'])

        this.setState(({board}) => {
            let swarm = createSwarm(this.hub, {uuid: board.id})

            swarm.on('peer', (peer, id) => {
                console.log('connected to', id)

                this.setState({busy: false})

                peer.send(JSON.stringify(this.state.board.operations))

                peer.on('data', data => {
                    this.setState(({board}) => {
                        for (let operation of JSON.parse(data)) {
                            board.pushOperation(operation)
                        }

                        return {board}
                    })
                })
            })

            swarm.on('disconnect', (_, id) => {
                console.log(id, 'disconnected')

                if (swarm.peers.length === 0) {
                    this.setState({busy: true})
                }
            })

            return {swarm}
        })
    }

    handleVertexClick(evt, vertex) {
        evt.preventDefault()

        this.setState(({swarm, board, sign}) => {
            if (swarm == null) return

            let operation = board.set(vertex, board.get(vertex) !== 0 ? 0 : sign)

            for (let peer of swarm.peers) {
                peer.send(JSON.stringify([operation]))
            }

            return {board}
        })
    }

    handleSignChange({sign}) {
        this.setState({sign})
    }

    render() {
        let {busy, sign, board} = this.state
        let signMap = board.render(19, 19)
        let markerMap = signMap.map(row => row.map(_ => null))
        let currentVertex = board.getCurrentVertex()

        if (currentVertex != null) {
            let [x, y] = currentVertex
            markerMap[y][x] = {type: signMap[y][x] !== 0 ? 'point' : 'cross'}
        }

        return h('div', {class: 'main-view'},
            h(Goban, {
                busy,
                showCoordinates: true,
                fuzzyStonePlacement: true,
                animateStonePlacement: true,

                signMap,
                markerMap,

                onVertexClick: this.handleVertexClick.bind(this)
            }),

            h(ToolBar, {sign, onChange: this.handleSignChange.bind(this)})
        )
    }
}
