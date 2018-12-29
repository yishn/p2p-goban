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

export function getMatrixDict(tree) {
    let matrix = [...Array(tree.getHeight() + 1)].map(_ => [])
    let dict = {}

    let inner = (node, matrix, dict, xshift, yshift) => {
        let sequence = [...tree.getSequence(node.id)]
        let hasCollisions = true

        while (hasCollisions) {
            hasCollisions = false

            for (let y = 0; y <= sequence.length; y++) {
                if (xshift >= matrix[yshift + y].length - (y === sequence.length)) continue

                hasCollisions = true
                xshift++
                break
            }
        }

        for (let y = 0; y < sequence.length; y++) {
            matrix[yshift + y][xshift] = sequence[y].id
            dict[sequence[y].id] = [xshift, yshift + y]
        }

        let lastSequenceNode = sequence.slice(-1)[0]

        for (let k = 0; k < lastSequenceNode.children.length; k++) {
            let child = lastSequenceNode.children[k]
            inner(child, matrix, dict, xshift + k, yshift + sequence.length)
        }

        return [matrix, dict]
    }

    return inner(tree.root, matrix, dict, 0, 0)
}
