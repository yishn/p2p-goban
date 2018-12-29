import {parseVertex} from '@sabaki/sgf'
import Board from './board'

export function vertexEquals([x1, y1], [x2, y2]) {
    return x1 === x2 && y1 === y2
}

export function signMapFromTreePosition(tree, position) {
    let node = tree.get(position)
    if (node == null || node.parentId == null) return new Board(19, 19).arrangement

    let board = new Board(19, 19, signMapFromTreePosition(tree, node.parentId))
    let sign, vertex

    if (node.data.B != null) {
        vertex = parseVertex(node.data.B[0])
        sign = 1
    } else if (node.data.W != null) {
        vertex = parseVertex(node.data.W[0])
        sign = -1
    }

    if (sign != null && vertex != null && board.hasVertex(vertex)) {
        return board.makeMove(sign, vertex).arrangement
    }

    return board.arrangement
}
