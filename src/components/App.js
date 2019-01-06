import {h, Component} from 'preact'
import {Goban} from '@sabaki/shudan'
import {parseVertex, stringifyVertex} from '@sabaki/sgf'
import GameTree from '@sabaki/crdt-gametree'

import createSwarm from 'webrtc-swarm'
import signalhub from 'signalhub'
import uuid from 'uuid/v4'

import config from '../../config.json'
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
            merger: helper.nodeMerger,
            root: {
                id: channel,
                data: {
                    GM: ['1'],
                    FF: ['4'],
                    CA: ['UTF-8'],
                    AP: ['p2p-goban:1.0.0'],
                    SZ: ['19']
                },
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
            position: tree.root.id,
            remotePositions: {}
        }
    }

    componentDidMount() {
        this.hub = signalhub(this.state.channel, config.signalhub.urls)
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
                },
                {
                    type: 'position',
                    data: {
                        from: this.state.position,
                        to: this.state.position
                    }
                }
            ]))

            peer.on('data', data => {
                this.setState(({chat, tree, remotePositions, position}) => {
                    let oldTree = tree
                    let oldPosition = position
                    let instructions = JSON.parse(data)
                    let treeChanges = []

                    for (let instruction of instructions) {
                        if (instruction.type === 'tree') {
                            tree = tree.applyChanges(instruction.data)
                            treeChanges.push(...instruction.data)
                        } else if (instruction.type === 'position') {
                            remotePositions[id] = instruction.data.to
                        } else if (instruction.type === 'chat') {
                            chat = [...chat, ...instruction.data]
                        }
                    }

                    // Find position to follow if applicable

                    let followPosition = (treeChanges.find(change =>
                        change.operation === 'appendNode'
                        && position === change.args[0]
                        && tree.get(change.returnValue) != null
                    ) || {}).returnValue

                    if (followPosition != null) {
                        position = followPosition
                    }

                    if (tree.get(position) == null) {
                        // Find a new valid position

                        for (let node of oldTree.listNodesVertically(position, -1, {})) {
                            if (tree.get(node.id) != null) {
                                position = node.id
                                break
                            }
                        }
                    }

                    if (oldPosition !== position) {
                        this.broadcastChanges([
                            {
                                type: 'position',
                                data: {from: oldPosition, to: position}
                            }
                        ])
                    }

                    return {chat, tree, remotePositions, position}
                })
            })
        })

        this.swarm.on('disconnect', (_, id) => {
            this.setState(({remotePositions}) => {
                delete remotePositions[id]

                return {
                    peers: this.swarm.peers,
                    remotePositions
                }
            })
        })
    }

    componentDidUpdate(_, prevState) {
        if (prevState.position !== this.state.position) {
            this.setState(({position, tree}) => {
                let node = tree.get(position)
                let sign = node.data.B != null ? -1 : 1

                return {sign}
            })
        }
    }

    handleWheel(evt) {
        evt.preventDefault()

        let {tree, position} = this.state
        let step = Math.sign(evt.deltaY)
        let node = tree.navigate(position, step, {})

        if (node != null && node.id !== position) {
            this.handlePositionChange(node.id)
        }
    }

    handleVertexClick(evt, vertex) {
        this.setState(({peers, sign, tree, position}) => {
            let board = helper.boardFromTreePosition(tree, position)
            let newTree, newPosition

            if (board.get(vertex) !== 0) {
                let node = tree.get(position)
                let currentVertex = parseVertex((node.data.W || node.data.B || [''])[0])

                if (!helper.vertexEquals(currentVertex, vertex)) return
                if (!confirm('Do you really want to remove this node?')) return

                newPosition = node.parentId
                newTree = tree.mutate(draft => {
                    draft.removeNode(position)
                })
            } else {
                let color = sign * (evt.button === 2 ? -1 : 1) > 0 ? 'B' : 'W'

                newTree = tree.mutate(draft => {
                    newPosition = draft.appendNode(position, {[color]: [stringifyVertex(vertex)]})
                })
            }

            this.broadcastChanges([
                {
                    type: 'position',
                    data: {from: position, to: newPosition}
                },
                {
                    type: 'tree',
                    data: newTree.getChanges()
                }
            ])

            return {
                tree: newTree,
                position: newPosition
            }
        })
    }

    broadcastChanges(changes) {
        if (changes.length === 0) return

        for (let peer of this.state.peers) {
            peer.send(JSON.stringify(changes))
        }
    }

    handlePositionChange(newPosition) {
        this.setState(({position}) => {
            if (position === newPosition) return

            this.broadcastChanges([
                {
                    type: 'position',
                    data: {from: position, to: newPosition}
                }
            ])

            return {position: newPosition}
        })
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
        let {id, peers, chat, sign, tree, position, remotePositions} = this.state
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

        let ghostStoneMap = node.children.map(child => ({
            sign: child.data.B != null ? 1 : child.data.W != null ? -1 : 0,
            vertex: parseVertex((child.data.B || child.data.W || [''])[0])
        })).filter(({sign, vertex}) =>
            sign !== 0 && !helper.vertexEquals(vertex, [-1, -1])
        ).reduce((acc, {sign, vertex: [x, y]}) => {
            acc[y][x] = {sign}
            return acc
        }, signMap.map(row => row.map(_ => null)))

        return h('div', {class: 'app-view'},
            h('div', {class: 'main-view'},
                h(Goban, {
                    innerProps: {
                        onContextMenu: evt => evt.preventDefault(),
                        onWheel: this.handleWheel.bind(this)
                    },

                    busy: peers.length === 0,
                    vertexSize: 26,
                    showCoordinates: true,
                    fuzzyStonePlacement: true,
                    animateStonePlacement: true,

                    signMap,
                    markerMap,
                    ghostStoneMap,

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

                    colors: Object.entries(Object.assign({}, remotePositions, {[id]: position}))
                        .reduce((acc, [id, position]) => {
                            acc[position] = helper.getIdentity(id).color
                            return acc
                        }, {}),

                    gridSize: 22,
                    nodeSize: 4,

                    onNodeClick: (_, {position}) => this.handlePositionChange(position)
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
