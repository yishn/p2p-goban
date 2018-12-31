import {parseVertex} from '@sabaki/sgf'
import Board from './board.js'

let boardCache = {}

export function vertexEquals([x1, y1], [x2, y2]) {
    return x1 === x2 && y1 === y2
}

export function boardFromTreePosition(tree, position) {
    if (position in boardCache) return boardCache[position]

    let node = tree.get(position)
    if (node == null || node.parentId == null) return new Board(19, 19)

    let board = boardFromTreePosition(tree, node.parentId)
    let sign, vertex

    if (node.data.B != null) {
        vertex = parseVertex(node.data.B[0])
        sign = 1
    } else if (node.data.W != null) {
        vertex = parseVertex(node.data.W[0])
        sign = -1
    }

    if (sign != null && vertex != null && board.hasVertex(vertex)) {
        board = board.makeMove(sign, vertex)
    }

    boardCache[position] = board
    return board
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

export function getMatrixWidth(y, matrix) {
    let keys = [...Array(10)]
        .map((_, i) => i + y - 4)
        .filter(i => i >= 0 && i < matrix.length)

    let padding = Math.min(...keys.map(i => {
        for (let j = 0; j < matrix[i].length; j++)
            if (matrix[i][j] != null) return j
        return 0
    }))

    let width = Math.max(...keys.map(i => matrix[i].length)) - padding

    return [width, padding]
}
