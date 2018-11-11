import {h, Component} from 'preact'
import {Goban} from '@sabaki/shudan'
import ToolBar from './ToolBar.js'

import Peer from 'simple-peer'
import Board from '../crdt-board.js'

export default class App extends Component {
    constructor(props) {
        super(props)

        this.peer = null

        this.state = {
            error: false,
            busy: true,
            sign: 1,
            board: new Board()
        }
    }

    componentDidMount() {
        let initiator = location.hash.length <= 1

        this.peer = new Peer({initiator, trickle: false})

        this.peer.on('signal', signal => {
            let code = JSON.stringify(signal)
            prompt('Signal', code)
        })

        this.peer.on('connect', () => {
            this.peer.send(JSON.parse(this.state.board.operations))
            this.setState({busy: false})
        })

        this.peer.on('data', data => {
            this.setState(({board}) => {
                for (let operation of JSON.parse(data)) {
                    board.pushOperation(operation)
                }

                return {board}
            })
        })

        this.peer.on('error', () => {
            this.setState({error: true})
        })
    }

    handleVertexClick(evt, vertex) {
        evt.preventDefault()

        if (this.peer == null) return

        this.setState(({board, sign}) => {
            let operation = board.set(vertex, board.get(vertex) !== 0 ? 0 : sign)
            this.peer.send(JSON.stringify([operation]))

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
            markerMap[y][x] = {type: 'point'}
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
