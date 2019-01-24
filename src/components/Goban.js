import {h, Component} from 'preact'
import {Goban as Shudan} from '@sabaki/shudan'
import {parseVertex} from '@sabaki/sgf'

import * as helper from '../helper.js'

export default class Goban extends Component {
    handleVertexMouseUp(evt, vertex) {
        if (!this.gobanMouseDown) return

        let {onVertexClick = () => {}} = this.props
        onVertexClick(evt, vertex)
    }

    render() {
        let {tree, position, highlights, busy} = this.props

        let node = tree.get(position)
        let board = helper.boardFromTreePosition(tree, position)
        let signMap = board.arrangement
        let currentVertex = parseVertex((node.data.B || node.data.W || [''])[0])

        return h('div', {class: 'goban-component'},
            h(Shudan, {
                innerProps: {
                    onContextMenu: evt => evt.preventDefault(),
                    onWheel: this.props.onWheel
                },

                busy,
                vertexSize: 26,
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
                    .filter(({sign, vertex}) => sign !== 0 && board.hasVertex(vertex))
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
