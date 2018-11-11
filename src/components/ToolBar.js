import {h, Component} from 'preact'
import classnames from 'classnames'

export default class ToolBar extends Component {
    handleClick(evt) {
        evt.preventDefault()

        let {onChange = () => {}} = this.props
        let sign = +evt.currentTarget.dataset.sign

        onChange({sign})
    }

    render() {
        let {sign} = this.props

        return h('ul', {class: 'tool-bar'},
            h('li', {class: classnames({current: sign === 1})},
                h('a', {href: '#', 'data-sign': '1', onClick: this.handleClick.bind(this)},
                    h('img', {
                        alt: 'Black Stone',
                        src: './node_modules/@sabaki/shudan/css/stone_1.png',
                        width: 16,
                        height: 16
                    })
                )
            ),
            h('li', {class: classnames({current: sign === -1})},
                h('a', {href: '#', 'data-sign': '-1', onClick: this.handleClick.bind(this)},
                    h('img', {
                        alt: 'White Stone',
                        src: './node_modules/@sabaki/shudan/css/stone_-1.png',
                        width: 16,
                        height: 16
                    })
                )
            )
        )
    }
}
