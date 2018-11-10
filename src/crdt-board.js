import uuid from 'uuid/v4'
import {vertexEquals} from './helper.js'

function compareTimestamps(timestamp1, timestamp2) {
    let isSmaller = true
    let isBigger = true
    let isEquals = true

    let keys = [...Object.keys(timestamp1), ...Object.keys(timestamp2)].sort()
        .filter((x, i, a) => i === 0 || a[i - 1] !== x)

    for (let key in keys) {
        let value1 = key in timestamp1 ? timestamp1[key] : 0
        let value2 = key in timestamp2 ? timestamp2[key] : 0

        if (value1 > value2) isSmaller = false
        else if (value1 < value2) isBigger = false
        else isEquals = false

        if (!isSmaller && !isBigger) return 0
        else if (!isEquals && !isBigger) return -1
        else if (!isEquals && !isSmaller) return 1
    }

    return null
}

function timestampEquals(timestamp1, timestamp2) {
    for (let key in timestamp1) {
        if (!(key in timestamp2) || timestamp2[key] !== timestamp1[key]) return false
    }

    for (let key in timestamp2) {
        if (!(key in timestamp1)) return false
    }

    return true
}

export default class Board {
    constructor() {
        this.id = uuid()
        this.timestamp = {[this.id]: 0}
        this.operations = []
    }

    incrementTimestamp() {
        this.timestamp[this.id]++
    }

    updateTimestamp(timestamp) {
        for (let id in timestamp) {
            if (!(id in this.timestamp) || this.timestamp[id] < timestamp[id]) {
                this.timestamp[id] = timestamp[id]
            }
        }
    }

    pushOperations(operation) {
        if (this.operations.some(o => timestampEquals(o.timestamp, operation.timestamp))) return

        this.updateTimestamp(operation.timestamp)

        let i = this.operations.length - 1

        while (i >= 0) {
            let {sign, timestamp} = this.operations[i]
            let comparison = compareTimestamps(timestamp, operation.timestamp)

            if (comparison == null) comparison = sign - operation.sign
            if (comparison >= 0) break

            i--
        }

        this.operations.splice(i + 1, 0, operation)
    }

    set(vertex, sign) {
        this.incrementTimestamp()

        this.operations.push({
            timestamp: Object.assign({}, this.timestamp),
            vertex,
            sign
        })
    }

    get(vertex) {
        for (let i = this.operations.length - 1; i >= 0; i--) {
            let operation = this.operations[i]
            if (!vertexEquals(vertex, operation.vertex)) continue

            return operation.sign
        }

        return 0
    }

    getCurrentVertex() {
        if (this.operations.length === 0) return null
        return this.operations.slice(-1)[0].vertex
    }

    render(width, height) {
        return [...Array(height)].map((_, y) =>
            [...Array(width)].map((_, x) =>
                this.get([x, y])
            )
        )
    }
}
