import {h, Component} from 'preact'
import {Goban} from '@sabaki/shudan'
import {parseVertex, stringifyVertex} from '@sabaki/sgf'
import GameTree from '@sabaki/crdt-gametree'

import createSwarm from 'webrtc-swarm'
import signalhub from 'signalhub'
import uuid from 'uuid/v4'

import * as helper from '../helper.js'
import ToolBar from './ToolBar.js'
import ChatBox from './ChatBox.js'
import GameGraph from './GameGraph.js'

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
                {
                    type: 'tree',
                    data: this.state.tree.getHistory()
                },
                {
                    type: 'chat',
                    data: this.state.chat
                }
            ]))

            peer.on('data', data => {
                this.setState(({chat, tree}) => {
                    let instructions = JSON.parse(data)

                    for (let instruction of instructions) {
                        if (instruction.type === 'tree') {
                            tree = tree.applyChanges(instruction.data)
                        } else if (instruction.type === 'chat') {
                            chat = [...chat, ...instruction.data]
                        }
                    }

                    return {chat, tree}
                })
            })
        })

        this.swarm.on('disconnect', (_, id) => {
            this.setState({peers: this.swarm.peers})
        })
    }

    handleVertexClick(evt, vertex) {
        this.setState(({peers, sign, tree, position}) => {
            let board = helper.boardFromTreePosition(tree, position)
            if (board.get(vertex) !== 0) return

            let color = sign * (evt.button === 2 ? -1 : 1) > 0 ? 'B' : 'W'
            let newPosition

            let newTree = tree.mutate(draft => {
                newPosition = draft.appendNode(position, {[color]: [stringifyVertex(vertex)]})
            })

            // Broadcast changes

            for (let peer of peers) {
                peer.send(JSON.stringify([{
                    type: 'tree',
                    data: newTree.getChanges()
                }]))
            }

            return {
                tree: newTree,
                position: newPosition
            }
        })
    }

    handleNodeClick(evt, {position}) {
        this.setState({position})
    }

    handleSignChange({sign}) {
        this.setState({sign})
    }

    handleChatSubmit({value}) {
        this.setState(({id, peers, chat}) => {
            let entry = {from: id, value}

            for (let peer of peers) {
                peer.send(JSON.stringify([{type: 'chat', data: [entry]}]))
            }

            return {chat: [...chat, entry]}
        })
    }

    render() {
        let {id, peers, chat, sign, tree, position} = this.state
        let node = tree.get(position)
        let signMap = helper.boardFromTreePosition(tree, position).arrangement
        let currentVertex = parseVertex((node.data.B || node.data.W || [''])[0])
        let markerMap = signMap.map((row, j) =>
            row.map((_, i) =>
                helper.vertexEquals([i, j], currentVertex)
                ? {type: 'point'}
                : null
            )
        )

        return h('div', {class: 'app-view'},
            h('div', {class: 'main-view'},
                h(Goban, {
                    innerProps: {
                        onContextMenu: evt => evt.preventDefault()
                    },

                    busy: peers.length === 0,
                    vertexSize: 26,
                    showCoordinates: true,
                    fuzzyStonePlacement: true,
                    animateStonePlacement: true,

                    signMap,
                    markerMap,

                    onVertexMouseUp: this.handleVertexClick.bind(this)
                }),

                h(ToolBar, {sign, onChange: this.handleSignChange.bind(this)})
            ),

            h('div', {class: 'side-bar'},
                h('div', {class: 'status-bar'},
                    `Connected to ${peers.length} ${
                        peers.length !== 1 ? 'peers' : 'peer'
                    }`
                ),

                h(GameGraph, {
                    tree,
                    position,
                    gridSize: 22,
                    nodeSize: 4,

                    onNodeClick: this.handleNodeClick.bind(this)
                }),

                h(ChatBox, {
                    author: id,
                    chat,
                    onSubmit: this.handleChatSubmit.bind(this)
                })
            )
        )
    }
}
