import {h, Component, render} from 'preact'
import {Goban} from '@sabaki/shudan'
import {parse as parseSGF, stringify as stringifySGF, parseVertex, stringifyVertex} from '@sabaki/sgf'
import GameTree from '@sabaki/crdt-gametree'

import createSwarm from 'webrtc-swarm'
import signalhub from 'signalhub'
import uuid from 'uuid/v4'

import config from '../../config.json'
import * as helper from '../helper.js'
import ToolBar from './ToolBar.js'
import PeerList from './PeerList.js'
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
            peers: {},
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
            this.setState(({peers}) => {
                peers[id] = peer
                return {peers}
            })

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
                        && tree.get(change.ret) != null
                    ) || {}).ret

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

                        if (tree.get(position) == null) {
                            position = tree.root.id
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
            this.setState(({peers, remotePositions}) => {
                delete peers[id]
                delete remotePositions[id]

                return {
                    peers,
                    remotePositions
                }
            })
        })
    }

    componentDidUpdate(_, prevState) {
        let {tree, position} = this.state

        if (prevState.position !== position) {
            let node = tree.get(position)
            let sign = node.data.B != null ? -1 : 1

            if (sign !== this.state.sign) this.setState({sign})
        }
    }

    broadcastChanges(changes) {
        if (changes.length === 0) return

        for (let peer of Object.values(this.state.peers)) {
            peer.send(JSON.stringify(changes))
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
        if (!this.gobanMouseDown) return
        this.gobanMouseDown = false

        this.setState(({sign, tree, position}) => {
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

    handlePositionChange(newPosition) {
        this.setState(({tree, position}) => {
            if (position === newPosition) return

            let sign = tree.get(newPosition).data.B != null ? -1 : 1

            this.broadcastChanges([
                {
                    type: 'position',
                    data: {from: position, to: newPosition}
                }
            ])

            return {sign, position: newPosition}
        })
    }

    handleSignChange({sign}) {
        this.setState({sign})
    }

    handlePeerClick({id}) {
        this.setState(({remotePositions, tree, position}) => {
            let newPosition = remotePositions[id]

            if (newPosition != null && tree.get(newPosition) != null) {
                this.broadcastChanges([
                    {
                        type: 'position',
                        data: {from: position, to: newPosition}
                    }
                ])

                return {position: newPosition}
            }
        })
    }

    handleChatSubmit({value}) {
        this.setState(({id, peers, chat}) => {
            let entry = {from: id, value}

            for (let peer of Object.values(peers)) {
                peer.send(JSON.stringify([{type: 'chat', data: [entry]}]))
            }

            return {chat: [...chat, entry]}
        })
    }

    async handleLoadClick() {
        let files = await new Promise(resolve => {
            let fileInput = render(h('input', {
                type: 'file',
                style: {visibility: 'hidden'},

                onChange: evt => {
                    resolve(evt.target.files)
                    fileInput.remove()
                }
            }), document.body)

            fileInput.click()
        })

        if (files.length === 0) return

        let sgf = await new Promise((resolve, reject) => {
            let reader = new FileReader()

            reader.onload = evt => resolve(evt.target.result)
            reader.onerror = evt => reject(evt.target.error)

            reader.readAsText(files[0])
        })

        let rootNodes = parseSGF(sgf)
        if (rootNodes.length === 0) return

        let newRoot = rootNodes[0]

        this.setState(({tree, position}) => {
            let newTree = tree.mutate(draft => {
                // Clean up

                for (let child of draft.root.children) {
                    draft.removeNode(child.id)
                }

                for (let prop in draft.root.data) {
                    draft.removeProperty(draft.root.id, prop)
                }

                // Insert root node properties

                for (let prop in newRoot.data) {
                    draft.updateProperty(draft.root.id, prop, newRoot.data[prop])
                }

                // Recursively append nodes

                let inner = (id, children) => {
                    for (let child of children) {
                        let childId = draft.appendNode(id, child.data)
                        inner(childId, child.children)
                    }
                }

                inner(draft.root.id, newRoot.children)
            })

            let newPosition = newTree.root.id

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

            return {position: newPosition, tree: newTree}
        })
    }

    handleDownloadClick() {
        let sgf = stringifySGF([this.state.tree.root])
        let href = `data:application/x-go-sgf;charset=utf-8,${encodeURIComponent(sgf)}`

        let link = render(h('a', {
            href,
            style: {visibility: 'hidden'},
            download: 'p2p-goban.sgf'
        }), document.body)

        link.click()
        link.remove()
    }

    render() {
        let {id, peers, chat, sign, tree, position, remotePositions} = this.state
        let node = tree.get(position)
        let board = helper.boardFromTreePosition(tree, position)
        let signMap = board.arrangement
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
            sign !== 0 && board.hasVertex(vertex)
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

                    busy: Object.keys(peers).length === 0,
                    vertexSize: 26,
                    showCoordinates: true,
                    fuzzyStonePlacement: true,
                    animateStonePlacement: true,

                    signMap,
                    markerMap,
                    ghostStoneMap,

                    onVertexMouseDown: () => this.gobanMouseDown = true,
                    onVertexMouseUp: this.handleVertexClick.bind(this)
                }),

                h(ToolBar, {
                    sign,
                    blackCaptures: board.captures[0],
                    whiteCaptures: board.captures[1],

                    onChange: evt => this.handleSignChange(evt),
                    onLoadClick: () => this.handleLoadClick().catch(alert),
                    onDownloadClick: () => this.handleDownloadClick()
                })
            ),

            h('div', {class: 'side-bar'},
                h(PeerList, {
                    selfId: id,
                    peerIds: Object.keys(peers),
                    activeIds: Object.keys(remotePositions).filter(id => remotePositions[id] === position),

                    onPeerClick: this.handlePeerClick.bind(this)
                }),

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
