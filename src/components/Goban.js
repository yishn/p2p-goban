import {h, Component} from 'preact'
import {BoundedGoban as Shudan} from '@sabaki/shudan'
import {parseVertex} from '@sabaki/sgf'

import * as helper from '../helper.js'

export default class Goban extends Component {
    constructor(props) {
        super(props)

        this.state = {
            maxWidth: 0,
            maxHeight: 0
        }
    }

    componentDidMount() {
        this.remeasure()

        window.addEventListener('resize', () => {
            clearTimeout(this.remeasureId)
            this.remeasureId = setTimeout(() => this.remeasure(), 500)
        })
    }

    remeasure() {
        this.shudanElement.style.position = 'absolute'

        let size = this.element.offsetHeight
        this.shudanElement.style.position = 'relative'

        this.setState({
            maxWidth: size,
            maxHeight: size
        })
    }

    handleVertexMouseUp(evt, vertex) {
        if (!this.gobanMouseDown) return

        let {onVertexClick = () => {}} = this.props
        onVertexClick(evt, vertex)
    }

    render() {
        let {tree, position, highlights, busy} = this.props

        let node = tree.get(position)
        let board = helper.boardFromTreePosition(tree, position)
        let signMap = board.signMap
        let currentVertex = parseVertex((node.data.B || node.data.W || [''])[0])

        return h('div',
            {
                ref: el => this.element = el,
                class: 'goban-component'
            },

            h(Shudan, {
                innerProps: {
                    ref: el => this.shudanElement = el,
                    onContextMenu: evt => evt.preventDefault(),
                    onWheel: this.props.onWheel
                },

                busy,
                maxWidth: this.state.maxWidth,
                maxHeight: this.state.maxHeight,
                showCoordinates: true,

                signMap,

                markerMap: signMap.map((row, j) => row.map((_, i) =>
                    helper.vertexEquals([i, j], currentVertex)
                    ? {type: 'point', label: 'Click to remove node'}
                    : null
                )),

                ghostStoneMap: node.children
                    .map(child => ({
                        sign: child.data.B != null ? 1 : child.data.W != null ? -1 : 0,
                        vertex: parseVertex((child.data.B || child.data.W || [''])[0])
                    }))
                    .filter(({sign, vertex}) => sign !== 0 && board.has(vertex))
                    .reduce((acc, {sign, vertex: [x, y]}) => {
                        acc[y][x] = {sign}
                        return acc
                    }, signMap.map(row => row.map(_ => null))),

                selectedVertices: Object.values(highlights)
                    .filter(x => x != null && x.position === position)
                    .map(x => x.vertex),

                onVertexMouseDown: () => this.gobanMouseDown = true,
                onVertexMouseUp: this.handleVertexMouseUp.bind(this)
            }),

            // Color highlights

            h('style', {},
                Object.entries(highlights)
                .filter(([_, x]) => x != null && x.position === position)
                .map(([id, {vertex: [x, y]}]) => {
                    let identity = helper.getIdentity(id)

                    return `.shudan-vertex[data-x="${x}"][data-y="${y}"] .shudan-selection {
                        border-color: rgb(${identity.color.join(',')});
                        background: rgba(${identity.color.join(',')}, .2);
                    }`
                })
                .join('')
            )
        )
    }
}
