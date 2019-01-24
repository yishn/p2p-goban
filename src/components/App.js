import {h, Component, render} from 'preact'
import {parse as parseSGF, stringify as stringifySGF, parseVertex, stringifyVertex} from '@sabaki/sgf'
import GameTree from '@sabaki/crdt-gametree'

import createSwarm from 'webrtc-swarm'
import signalhub from 'signalhub'
import uuid from 'uuid/v4'
import copyToClipboard from 'copy-text-to-clipboard'

import config from '../../config.json'
import * as helper from '../helper.js'
import Goban from './Goban.js'
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
            remotePositions: {},
            followPeer: null,
            highlights: {}
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

            let buffer = ''

            // Synchronize state

            this.sendInstructions(peer, [
                {
                    type: 'tree',
                    data: this.state.tree.getHistory()
                },
                {
                    type: 'chat',
                    data: this.state.chat
                },
                {
                    type: 'highlight',
                    data: this.state.highlights[this.state.id]
                },
                {
                    type: 'position',
                    data: {
                        from: this.state.position,
                        to: this.state.position
                    }
                }
            ])

            peer.on('data', data => {
                if (buffer.length > 0 || data.slice(-1) !== '\n') {
                    buffer += data.toString()
                } else {
                    buffer = data.toString()
                }

                if (buffer.slice(-1) !== '\n') return

                let instructions = JSON.parse(buffer)
                buffer = ''

                this.handleInstructions(id, instructions)
            })
        })

        this.swarm.on('disconnect', (_, id) => {
            this.setState(({peers, remotePositions, highlights}) => {
                delete peers[id]
                delete remotePositions[id]
                delete highlights[id]

                return {
                    peers,
                    remotePositions,
                    highlights
                }
            })
        })
    }

    componentDidUpdate(_, prevState) {
        let {id, tree, position, remotePositions, highlights} = this.state

        if (prevState.position !== position) {
            let node = tree.get(position)
            let sign = node.data.B != null ? -1 : 1

            if (sign !== this.state.sign) this.setState({sign})
        }

        // Clean up highlights

        let highlightsChange = false
        let positions = Object.assign({}, remotePositions, {[id]: position})

        for (let id in highlights) {
            if (highlights[id] != null && positions[id] !== highlights[id].position) {
                delete highlights[id]
                highlightsChange = true
            }
        }

        if (highlightsChange) this.setState({highlights})
    }

    handleInstructions(id, instructions) {
        this.setState(({chat, tree, position, followPeer, remotePositions, highlights}) => {
            let oldTree = tree
            let oldPosition = position
            let treeChanges = []

            for (let instruction of instructions) {
                if (instruction.type === 'tree') {
                    tree = tree.applyChanges(instruction.data)
                    treeChanges.push(...instruction.data)
                } else if (instruction.type === 'position') {
                    remotePositions[id] = instruction.data.to
                } else if (instruction.type === 'highlight') {
                    if (instruction.data != null) {
                        highlights[id] = instruction.data
                    } else {
                        delete highlights[id]
                    }
                } else if (instruction.type === 'chat') {
                    chat = [...chat, ...instruction.data]
                }
            }

            // Find position to follow if applicable

            let followPosition = followPeer === id
                ? remotePositions[id]
                : (treeChanges.find(change =>
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
                this.broadcastInstructions([
                    {
                        type: 'position',
                        data: {from: oldPosition, to: position}
                    }
                ])
            }

            return {chat, tree, position, remotePositions, highlights}
        })
    }

    broadcastInstructions(instructions) {
        if (instructions.length === 0) return

        for (let peer of Object.values(this.state.peers)) {
            this.sendInstructions(peer, instructions)
        }
    }

    sendInstructions(peer, instructions) {
        if (instructions.length === 0) return

        peer.send(JSON.stringify(instructions) + '\n')
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
        this.setState(({id, sign, tree, position, highlights}) => {
            if (evt.ctrlKey || evt.metaKey) {
                let highlight = highlights[id]

                highlights[id] = highlight != null && helper.vertexEquals(highlight.vertex, vertex)
                    ? null
                    : {position, vertex}

                this.broadcastInstructions([
                    {
                        type: 'highlight',
                        data: highlights[id]
                    }
                ])

                return {highlights}
            } else {
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

                this.broadcastInstructions([
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
            }
        })
    }

    handlePositionChange(newPosition) {
        this.setState(({tree, position}) => {
            if (position === newPosition) return

            let sign = tree.get(newPosition).data.B != null ? -1 : 1

            this.broadcastInstructions([
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
                this.broadcastInstructions([
                    {
                        type: 'position',
                        data: {from: position, to: newPosition}
                    }
                ])

                return {position: newPosition}
            }
        })
    }

    handleFollowClick({id}) {
        this.setState(({position, followPeer, remotePositions}) => {
            if (followPeer === id) {
                return {followPeer: null}
            }

            this.broadcastInstructions([
                {
                    type: 'position',
                    data: {from: position, to: remotePositions[id]}
                }
            ])

            return {
                followPeer: id,
                position: remotePositions[id]
            }
        })
    }

    handleChatSubmit({value}) {
        this.setState(({id, chat}) => {
            let entry = {from: id, value}

            this.broadcastInstructions([{type: 'chat', data: [entry]}])

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

            this.broadcastInstructions([
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

    handleShareClick() {
        copyToClipboard(window.location.toString())
        alert('The URL has been copied into your clipboard. Share it with others to let them join you.')
    }

    render() {
        let {
            id, peers, chat, sign, tree, position,
            followPeer, remotePositions, highlights
        } = this.state

        let board = helper.boardFromTreePosition(tree, position)

        return h('div', {class: 'app-view'},
            h('div', {class: 'main-view'},
                h(Goban, {
                    tree,
                    position,
                    highlights,
                    busy: Object.keys(peers).length === 0,

                    onVertexClick: this.handleVertexClick.bind(this),
                    onWheel: this.handleWheel.bind(this),
                }),

                h(ToolBar, {
                    sign,
                    blackCaptures: board.captures[0],
                    whiteCaptures: board.captures[1],

                    onChange: evt => this.handleSignChange(evt),
                    onLoadClick: () => this.handleLoadClick().catch(alert),
                    onDownloadClick: () => this.handleDownloadClick(),
                    onShareClick: () => this.handleShareClick()
                })
            ),

            h('div', {class: 'side-bar'},
                h(PeerList, {
                    selfId: id,
                    peerIds: Object.keys(peers),
                    activeIds: Object.keys(remotePositions)
                        .filter(id => remotePositions[id] === position),
                    highlightIds: Object.keys(highlights)
                        .filter(id => highlights[id] != null && highlights[id].position !== position),
                    followId: followPeer,

                    onPeerClick: this.handlePeerClick.bind(this),
                    onFollowClick: this.handleFollowClick.bind(this)
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
