import {h, Component} from 'preact'
import {Goban} from '@sabaki/shudan'
import GameTree from '@sabaki/crdt-gametree'
import ToolBar from './ToolBar.js'
import ChatBox from './ChatBox.js'

import createSwarm from 'webrtc-swarm'
import signalhub from 'signalhub'
import uuid from 'uuid/v4'

export default class App extends Component {
    constructor(props) {
        super(props)

        let id = uuid()
        let channel = location.hash.length <= 1 ? uuid() : location.hash.slice(1)
        if (location.hash.length <= 1) history.replaceState(null, '', `#${channel}`)

        let tree = new GameTree({
            id,
            root: {
                id: channel,
                data: {},
                parentId: null,
                children: []
            }
        })

        this.hub = null
        this.swarm = null

        this.state = {
            id,
            channel,
            peers: [],
            chat: [],
            sign: 1,
            tree,
            position: tree.root.id
        }
    }

    componentDidMount() {
        this.hub = signalhub(this.state.channel, ['https://signalhub.mafintosh.com'])
        this.swarm = createSwarm(this.hub, {uuid: this.state.id})

        this.swarm.on('connect', (peer, id) => {
            this.setState({peers: this.swarm.peers})

            // Synchronize state

            peer.send(JSON.stringify([
                ...this.state.chat.map(entry => ({
                    type: 'chat',
                    data: entry
                }))
            ]))

            peer.on('data', data => {
                this.setState(({chat}) => {
                    let instructions = JSON.parse(data)

                    for (let instruction of instructions) {
                        if (instruction.type === 'board') {
                            // board.pushOperation(instruction.data)
                        } else if (instruction.type === 'chat') {
                            chat = [...chat, instruction.data]
                        }
                    }

                    return {chat}
                })
            })
        })

        this.swarm.on('disconnect', (_, id) => {
            this.setState({peers: this.swarm.peers})
        })
    }

    handleVertexClick(evt, vertex) {
    }

    handleSignChange({sign}) {
        this.setState({sign})
    }

    handleChatSubmit({value}) {
        this.setState(({id, peers, chat}) => {
            let entry = {from: id, value}

            for (let peer of peers) {
                peer.send(JSON.stringify([{type: 'chat', data: entry}]))
            }

            return {chat: [...chat, entry]}
        })
    }

    render() {
        let {id, peers, chat, sign, board} = this.state

        return h('div', {class: 'app-view'},
            h('div', {class: 'main-view'},
                h(Goban, {
                    busy: peers.length === 0,
                    vertexSize: 26,
                    showCoordinates: true,
                    fuzzyStonePlacement: true,
                    animateStonePlacement: true,

                    onVertexClick: this.handleVertexClick.bind(this)
                }),

                h(ToolBar, {sign, onChange: this.handleSignChange.bind(this)})
            ),

            h('div', {class: 'side-bar'},
                h('div', {class: 'status-bar'},
                    `Connected to ${peers.length} ${
                        peers.length !== 1 ? 'peers' : 'peer'
                    }`
                ),
                h(ChatBox, {
                    author: id,
                    chat,
                    onSubmit: this.handleChatSubmit.bind(this)
                })
            )
        )
    }
}
