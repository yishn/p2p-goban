import {h, Component} from 'preact'
import {Goban as Shudan} from '@sabaki/shudan'

export default class Goban extends Component {
    render() {
        let {busy, signMap, markerMap, ghostStoneMap, onMouseWheel = () => {}} = this.props

        return h(Shudan, {
            innerProps: {
                onContextMenu: evt => evt.preventDefault(),
                onWheel: onMouseWheel
            },

            busy,
            vertexSize: 26,
            showCoordinates: true,
            fuzzyStonePlacement: true,
            animateStonePlacement: true,

            signMap,
            markerMap,
            ghostStoneMap,

            onVertexMouseUp: this.handleVertexClick.bind(this)
        })
    }
}
