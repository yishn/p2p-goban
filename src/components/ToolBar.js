import {h, Component} from 'preact'
import classnames from 'classnames'

export default class ToolBar extends Component {
    handleSignClick(evt) {
        evt.preventDefault()

        let {onChange = () => {}} = this.props
        let sign = +evt.currentTarget.dataset.sign

        onChange({sign})
    }

    render() {
        let {
            sign, blackCaptures, whiteCaptures,
            onDownloadClick = () => {},
            onLoadClick = () => {},
            onShareClick = () => {}
        } = this.props

        return h('ul', {class: 'tool-bar'},
            h('li', {class: classnames('button', {current: sign === 1})},
                h('a', {href: '#', 'data-sign': '1', onClick: this.handleSignClick.bind(this)},
                    h('img', {
                        alt: 'Black Stone',
                        src: './node_modules/@sabaki/shudan/css/stone_1.png',
                        width: 16,
                        height: 16
                    }), ' ',

                    h('strong', {}, blackCaptures)
                )
            ),

            h('li', {class: classnames('button', {current: sign === -1})},
                h('a', {href: '#', 'data-sign': '-1', onClick: this.handleSignClick.bind(this)},
                    h('img', {
                        alt: 'White Stone',
                        src: './node_modules/@sabaki/shudan/css/stone_-1.png',
                        width: 16,
                        height: 16
                    }), ' ',

                    h('strong', {}, whiteCaptures)
                )
            ),

            h('li', {class: 'spacer'}),

            h('li', {},
                h('a', {
                    href: '#',
                    onClick: evt => (evt.preventDefault(), onLoadClick())
                }, 'Load SGF')
            ),

            h('li', {},
                h('a', {
                    href: '#',
                    onClick: evt => (evt.preventDefault(), onDownloadClick())
                }, 'Download SGF')
            ),

            h('li', {},
                h('a', {
                    href: '#',
                    onClick: evt => (evt.preventDefault(), onShareClick())
                }, 'Share')
            )
        )
    }
}
