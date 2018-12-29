import {vertexEquals} from './helper'

const alpha = 'ABCDEFGHJKLMNOPQRSTUVWXYZ'

export default class Board {
    constructor(width = 19, height = 19, arrangement = [], captures = null) {
        this.width = width
        this.height = height
        this.captures = captures ? captures.slice() : [0, 0]
        this.arrangement = []
        this.markers = null
        this.lines = []
        this.childrenInfo = {}
        this.siblingsInfo = {}

        // Initialize maps

        for (let y = 0; y < this.height; y++) {
            this.arrangement[y] = y in arrangement ? [...arrangement[y]] : Array(this.width).fill(0)
        }

        this.markers = this.arrangement.map(row => row.map(_ => null))
    }

    get([x, y]) {
        return this.arrangement[y] ? this.arrangement[y][x] : undefined
    }

    set([x, y], sign) {
        this.arrangement[y][x] = sign
        return this
    }

    clone() {
        return new Board(this.width, this.height, this.arrangement, this.captures)
    }

    hasVertex([x, y]) {
        return 0 <= x && x < this.width && 0 <= y && y < this.height
    }

    clear() {
        this.arrangement = this.arrangement.map(row => row.map(_ => 0))
    }

    getDistance(v, w) {
        return Math.abs(v[0] - w[0]) + Math.abs(v[1] - w[1])
    }

    getNeighbors(vertex, ignoreBoard = false) {
        if (!ignoreBoard && !this.hasVertex(vertex)) return []

        let [x, y] = vertex
        let allNeighbors = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]

        return ignoreBoard ? allNeighbors : allNeighbors.filter(v => this.hasVertex(v))
    }

    getConnectedComponent(vertex, func, result = null) {
        if (func instanceof Array) {
            let signs = func
            func = v => signs.includes(this.get(v))
        } else if (typeof func === 'number') {
            let sign = func
            func = v => this.get(v) === sign
        }

        if (!this.hasVertex(vertex)) return []
        if (!result) result = [vertex]

        // Recursive depth-first search

        for (let v of this.getNeighbors(vertex)) {
            if (!func(v)) continue
            if (result.some(w => vertexEquals(v, w))) continue

            result.push(v)
            this.getConnectedComponent(v, func, result)
        }

        return result
    }

    getChain(vertex) {
        return this.getConnectedComponent(vertex, this.get(vertex))
    }

    hasLiberties(vertex, visited = {}) {
        let sign = this.get(vertex)
        if (!this.hasVertex(vertex) || sign === 0) return false

        if (vertex in visited) return false
        let neighbors = this.getNeighbors(vertex)

        if (neighbors.some(n => this.get(n) === 0))
            return true

        visited[vertex] = true

        return neighbors.filter(n => this.get(n) === sign)
        .some(n => this.hasLiberties(n, visited))
    }

    getLiberties(vertex) {
        if (!this.hasVertex(vertex) || this.get(vertex) === 0) return []

        let chain = this.getChain(vertex)
        let liberties = []
        let added = {}

        for (let c of chain) {
            let freeNeighbors = this.getNeighbors(c).filter(n => this.get(n) === 0)

            liberties.push(...freeNeighbors.filter(n => !(n in added)))
            freeNeighbors.forEach(n => added[n] = true)
        }

        return liberties
    }

    getRelatedChains(vertex) {
        if (!this.hasVertex(vertex) || this.get(vertex) === 0) return []

        let area = this.getConnectedComponent(vertex, [this.get(vertex), 0])
        return area.filter(v => this.get(v) === this.get(vertex))
    }

    vertex2coord(vertex) {
        if (!this.hasVertex(vertex)) return null
        return alpha[vertex[0]] + (this.height - vertex[1])
    }

    coord2vertex(coord) {
        let x = alpha.indexOf(coord[0].toUpperCase())
        let y = this.height - +coord.slice(1)
        return [x, y]
    }

    isValid() {
        let liberties = {}

        for (let x = 0; x < this.width; x++) {
            for (let y = 0; y < this.height; y++) {
                let vertex = [x, y]
                if (this.get(vertex) === 0 || vertex in liberties) continue
                if (!this.hasLiberties(vertex)) return false

                this.getChain(vertex).forEach(v => liberties[v] = true)
            }
        }

        return true
    }

    makeMove(sign, vertex) {
        let move = this.clone()

        if (sign === 0 || !this.hasVertex(vertex)) return move

        sign = sign > 0 ? 1 : -1
        move.set(vertex, sign)

        // Remove captured stones

        let deadNeighbors = move.getNeighbors(vertex)
            .filter(n => move.get(n) === -sign && !move.hasLiberties(n))

        for (let n of deadNeighbors) {
            if (move.get(n) === 0) continue

            for (let c of move.getChain(n)) {
                move.set(c, 0)
                move.captures[(-sign + 1) / 2]++
            }
        }

        move.set(vertex, sign)

        // Detect suicide

        if (deadNeighbors.length === 0 && !move.hasLiberties(vertex)) {
            for (let c of move.getChain(vertex)) {
                move.set(c, 0)
                move.captures[(sign + 1) / 2]++
            }
        }

        return move
    }
}
