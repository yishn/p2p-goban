import {h, Component} from 'preact'
import {Goban} from '@sabaki/shudan'
import ToolBar from './ToolBar.js'
import ChatBox from './ChatBox.js'

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
            chat: [],
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

            swarm.on('connect', (peer, id) => {
                this.setState({})

                // Synchronize state

                peer.send(JSON.stringify([
                    ...this.state.board.operations.map(operation => ({
                        type: 'board',
                        data: operation
                    })),
                    ...this.state.chat.map(entry => ({
                        type: 'chat',
                        data: entry
                    }))
                ]))

                peer.on('data', data => {
                    this.setState(({chat, board}) => {
                        let instructions = JSON.parse(data)

                        for (let instruction of instructions) {
                            if (instruction.type === 'board') {
                                board.pushOperation(instruction.data)
                            } else if (instruction.type === 'chat') {
                                chat = [...chat, instruction.data]
                            }
                        }

                        return {chat, board}
                    })
                })
            })

            swarm.on('disconnect', (_, id) => {
                this.setState({})
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
                peer.send(JSON.stringify([{type: 'board', data: operation}]))
            }

            return {board}
        })
    }

    handleSignChange({sign}) {
        this.setState({sign})
    }

    handleChatSubmit({value}) {
        this.setState(({swarm, board, chat}) => {
            if (swarm == null) return

            let entry = {from: board.id, value}

            for (let peer of swarm.peers) {
                peer.send(JSON.stringify([{type: 'chat', data: entry}]))
            }

            return {chat: [...chat, entry]}
        })
    }

    render() {
        let {swarm, chat, sign, board} = this.state
        let signMap = board.render(19, 19)
        let markerMap = signMap.map(row => row.map(_ => null))
        let currentVertex = board.getCurrentVertex()

        if (currentVertex != null) {
            let [x, y] = currentVertex
            markerMap[y][x] = {type: signMap[y][x] !== 0 ? 'point' : 'cross'}
        }

        return h('div', {class: 'app-view'},
            h('div', {class: 'main-view'},
                h(Goban, {
                    busy: swarm == null || swarm.peers.length === 0,
                    vertexSize: 26,
                    showCoordinates: true,
                    fuzzyStonePlacement: true,
                    animateStonePlacement: true,

                    signMap,
                    markerMap,

                    onVertexClick: this.handleVertexClick.bind(this)
                }),

                h(ToolBar, {sign, onChange: this.handleSignChange.bind(this)})
            ),

            h('div', {class: 'side-bar'},
                h('div', {class: 'status-bar'},
                    `Connected to ${
                        swarm == null ? 0 : swarm.peers.length
                    } ${
                        swarm == null || swarm.peers.length !== 1 ? 'peers' : 'peer'
                    }`
                ),
                h(ChatBox, {
                    author: board.id,
                    chat,
                    onSubmit: this.handleChatSubmit.bind(this)
                })
            )
        )
    }
}
