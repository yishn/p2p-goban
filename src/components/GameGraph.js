import {h, Component} from 'preact'
import classNames from 'classnames'
import * as helper from '../helper.js'

class GameGraphNode extends Component {
    constructor() {
        super()

        this.state = {
            hover: false
        }

        this.handleMouseMove = evt => {
            if (!this.element) return

            let {clientX: x, clientY: y} = evt
            let {position, mouseShift: [sx, sy], gridSize} = this.props
            let mousePosition = [x + sx, y + sy]
            let hover = false

            if (mousePosition.every((x, i) =>
                Math.ceil(position[i] - gridSize / 2) <= x
                && x <= Math.floor(position[i] + gridSize / 2) - 1
            )) {
                hover = true
            }

            if (hover !== this.state.hover) {
                this.setState({hover})
            }
        }
    }

    componentDidMount() {
        document.addEventListener('mousemove', this.handleMouseMove)
    }

    componentWillUnmount() {
        document.removeEventListener('mousemove', this.handleMouseMove)
    }

    shouldComponentUpdate({type, current, fill, nodeSize, gridSize}, {hover}) {
        return type !== this.props.type
            || current !== this.props.current
            || fill !== this.props.fill
            || nodeSize !== this.props.nodeSize
            || gridSize !== this.props.gridSize
            || hover !== this.state.hover
    }

    render({
        position: [left, top],
        type,
        current,
        fill,
        nodeSize
    }, {
        hover
    }) {
        return h('path', {
            ref: el => this.element = el,
            d: (() => {
                let nodeSize2 = nodeSize * 2

                if (type === 'square') {
                    return `M ${left - nodeSize} ${top - nodeSize}
                        h ${nodeSize2} v ${nodeSize2} h ${-nodeSize2} Z`
                } else if (type === 'circle') {
                    return `M ${left} ${top} m ${-nodeSize} 0
                        a ${nodeSize} ${nodeSize} 0 1 0 ${nodeSize2} 0
                        a ${nodeSize} ${nodeSize} 0 1 0 ${-nodeSize2} 0`
                } else if (type === 'diamond') {
                    let diamondSide = Math.round(Math.sqrt(2) * nodeSize)

                    return `M ${left} ${top - diamondSide}
                        L ${left - diamondSide} ${top} L ${left} ${top + diamondSide}
                        L ${left + diamondSide} ${top} Z`
                } else if (type === 'bookmark') {
                    return `M ${left - nodeSize} ${top - nodeSize * 1.3}
                        h ${nodeSize2} v ${nodeSize2 * 1.3}
                        l ${-nodeSize} ${-nodeSize} l ${-nodeSize} ${nodeSize} Z`
                }

                return ''
            })(),

            class: classNames({hover, current}, 'node'),
            fill
        })
    }
}

class GameGraphEdge extends Component {
    shouldComponentUpdate({positionAbove, positionBelow, current, length, gridSize}) {
        return length !== this.props.length
            || current !== this.props.current
            || gridSize !== this.props.gridSize
            || !helper.vertexEquals(positionAbove, this.props.positionAbove)
            || !helper.vertexEquals(positionBelow, this.props.positionBelow)
    }

    render({
        positionAbove: [left1, top1],
        positionBelow: [left2, top2],
        length,
        gridSize,
        current
    }) {
        let points

        if (left1 === left2) {
            points = `${left1},${top1} ${left1},${top2 + length}`
        } else {
            points = `${left1},${top1} ${left2 - gridSize},${top2 - gridSize} `
                + `${left2},${top2} ${left2},${top2 + length}`
        }

        return h('polyline', {
            points,
            fill: 'none',
            stroke: current ? '#ccc' : '#777',
            'stroke-width': current ? 2 : 1
        })
    }
}

export default class GameGraph extends Component {
    constructor(props) {
        super(props)

        this.state = {
            cameraPosition: [-props.gridSize, -props.gridSize],
            viewportSize: [0, 0],
            viewportPosition: [0, 0],
            matrixDict: null
        }

        this.mousePosition = [-100, -100]
        this.matrixDictHash = null
        this.matrixDictCache = {}

        this.handleNodeClick = this.handleNodeClick.bind(this)
        this.handleGraphMouseDown = this.handleGraphMouseDown.bind(this)
    }

    componentDidMount() {
        document.addEventListener('mousemove', evt => {
            if (!this.svgElement) return

            let {clientX: x, clientY: y, movementX, movementY} = evt
            let {cameraPosition: [cx, cy], viewportPosition: [vx, vy]} = this.state

            if (this.mouseDown === 0) {
                this.drag = true
            } else {
                movementX = movementY = 0
                this.drag = false
            }

            this.mousePosition = [x - vx, y - vy]

            if (this.drag) {
                evt.preventDefault()
                this.setState({cameraPosition: [cx - movementX, cy - movementY]})
            }
        })

        document.addEventListener('mouseup', () => {
            this.mouseDown = null
        })

        window.addEventListener('resize', () => {
            clearTimeout(this.remeasureId)
            this.remeasureId = setTimeout(() => this.remeasure(), 500)
        })

        window.addEventListener('scroll', () => {
            clearTimeout(this.remeasureId)
            this.remeasureId = setTimeout(() => this.remeasure(), 500)
        })

        this.remeasure()
        this.componentWillReceiveProps()
    }

    componentWillReceiveProps({position, tree} = {}) {
        if (position == null) return

        if (tree == null || tree !== this.props.tree) {
            this.setState({matrixDict: this.getMatrixDict(tree || this.props.tree)})
        }

        clearTimeout(this.updateCameraPositionId)
        this.updateCameraPositionId = setTimeout(() => this.updateCameraPosition(), 100)
    }

    getMatrixDict(tree) {
        if (tree.getStructureHash() !== this.matrixDictHash) {
            this.matrixDictHash = tree.getStructureHash()
            this.matrixDictCache = helper.getMatrixDict(tree)
        }

        return this.matrixDictCache
    }

    updateCameraPosition() {
        let {gridSize, position} = this.props
        let {matrixDict: [matrix, dict]} = this.state

        let [x, y] = dict[position]
        let [width, padding] = helper.getMatrixWidth(y, matrix)

        let relX = width === 1 ? 0 : 1 - 2 * (x - padding) / (width - 1)
        let diff = (width - 1) * gridSize / 2
        diff = Math.min(diff, this.state.viewportSize[0] / 2 - gridSize)

        this.setState({
            cameraPosition: [
                x * gridSize + relX * diff - this.state.viewportSize[0] / 2,
                y * gridSize - this.state.viewportSize[1] / 2
            ].map(z => Math.round(z))
        })
    }

    remeasure() {
        let {left, top, width, height} = this.element.getBoundingClientRect()

        this.setState({
            viewportSize: [width, height],
            viewportPosition: [left, top]
        })
    }

    handleGraphMouseDown(evt) {
        this.mouseDown = evt.button
    }

    handleNodeClick(evt) {
        if (this.drag) {
            this.drag = false
            return
        }

        let {onNodeClick = () => {}, tree, gridSize} = this.props
        let {matrixDict: [matrix, ], cameraPosition: [cx, cy]} = this.state
        let [mx, my] = this.mousePosition
        let [nearestX, nearestY] = [mx + cx, my + cy].map(z => Math.round(z / gridSize))

        if (!matrix[nearestY] || !matrix[nearestY][nearestX]) return

        onNodeClick(evt, {
            tree,
            position: matrix[nearestY][nearestX]
        })
    }

    renderNodes({
        tree,
        gridSize,
        nodeSize
    }, {
        matrixDict: [matrix, dict],
        cameraPosition: [cx, cy],
        viewportSize: [width, height],
        viewportPosition: [vx, vy]
    }) {
        let nodeColumns = []
        let edges = []

        let [minX, minY] = [cx, cy].map(z => Math.max(Math.ceil(z / gridSize) - 2, 0))
        let [maxX, maxY] = [cx, cy].map((z, i) => (z + [width, height][i]) / gridSize + 2)
        minY -= 3
        maxY += 3

        let doneTreeBones = []

        // Render only nodes that are visible

        for (let x = minX; x <= maxX; x++) {
            let column = []

            for (let y = minY; y <= maxY; y++) {
                if (matrix[y] == null || matrix[y][x] == null) continue

                let id = matrix[y][x]
                let node = tree.get(id)
                let parent = tree.get(node.parentId)

                // Render node

                let isCurrentNode = this.props.position === id
                let opacity = 1
                let fillRGB = isCurrentNode ? [255, 174, 61]
                    : this.props.colored.includes(id) ? [72, 134, 213]
                    : [238, 238, 238]

                let left = x * gridSize
                let top = y * gridSize

                column.push(h(GameGraphNode, {
                    key: y,
                    mouseShift: [cx - vx, cy - vy],
                    position: [left, top],
                    type: node.data.HO != null
                        ? 'bookmark' // Bookmark node
                        : node.data.B != null && node.data.B[0] === '' || node.data.W != null && node.data.W[0] === ''
                        ? 'square' // Pass node
                        : node.data.B == null && node.data.W == null
                        ? 'diamond' // Non-move node
                        : 'circle', // Normal node
                    current: isCurrentNode,
                    fill: `rgb(${fillRGB.map(x => x * opacity).join(',')})`,
                    nodeSize: nodeSize + 1,
                    gridSize
                }))

                if (!doneTreeBones.includes(id)) {
                    // A *tree bone* denotes a straight edge through the tree

                    let positionAbove, positionBelow

                    if (parent != null) {
                        // Render parent edge with tree bone

                        let [px, py] = dict[parent.id]

                        positionAbove = [px * gridSize, py * gridSize]
                        positionBelow = [left, top]
                    } else {
                        // Render tree bone only

                        positionAbove = [left, top]
                        positionBelow = positionAbove
                    }

                    let sequence = [...tree.getSequence(id)]

                    if (positionAbove != null && positionBelow != null) {
                        edges.push(h(GameGraphEdge, {
                            key: id,
                            positionAbove,
                            positionBelow,
                            length: (sequence.length - 1) * gridSize,
                            current: true,
                            gridSize
                        }))

                        doneTreeBones.push(...sequence.map(node => node.id))
                    }
                }

                if (node.children.length > 1) {
                    // Render successor edges with subtree bones

                    for (let child of node.children) {
                        let [nx, ny] = dict[child.id]
                        let subsequence = [...tree.getSequence(child.id)]

                        edges.push(h(GameGraphEdge, {
                            key: child.id,
                            positionAbove: [left, top],
                            positionBelow: [nx * gridSize, ny * gridSize],
                            length: (subsequence.length - 1) * gridSize,
                            current: true,
                            gridSize
                        }))

                        doneTreeBones.push(...subsequence.map(node => node.id))
                    }
                }
            }

            if (column.length > 0) nodeColumns.push(h('g', {key: x}, column))
        }

        return [h('g', {}, edges), h('g', {}, nodeColumns)]
    }

    render(_, {
        matrixDict,
        viewportSize,
        cameraPosition: [cx, cy]
    }) {
        return h('section',
            {
                ref: el => this.element = el,
                class: 'game-graph'
            },

            matrixDict && viewportSize && h('svg',
                {
                    ref: el => this.svgElement = el,
                    width: viewportSize[0],
                    height: viewportSize[1],

                    onClick: this.handleNodeClick,
                    onContextMenu: this.handleNodeClick,
                    onMouseDown: this.handleGraphMouseDown,
                    onMouseUp: this.handleGraphMouseUp
                },

                h('g',
                    {
                        style: {transform: `translate(${-cx}px, ${-cy}px)`}
                    },

                    this.renderNodes(this.props, this.state)
                )
            )
        )
    }
}

