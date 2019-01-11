import {h, Component} from 'preact'
import classnames from 'classnames'
import {getIdentity} from '../helper.js'

class PeerListItem extends Component {
    shouldComponentUpdate(nextProps) {
        return nextProps.id !== this.props.id
            || nextProps.self !== this.props.self
    }

    render() {
        let {id, self, onClick = () => {}} = this.props
        let identity = getIdentity(id)

        return h('li', {class: classnames('peer', {self})},
            h('a',
                {
                    href: '#',
                    title: !self && `Go to ${identity.name}`,

                    onClick: evt => (evt.preventDefault(), onClick(evt))
                },

                h('span', {
                    class: 'color',
                    style: {
                        background: `rgb(${identity.color.join(',')})`
                    }
                }), ' ',

                h('span', {class: 'name'}, identity.name), ' ',

                self && h('em', {}, '(You)')
            )
        )
    }
}

export default class PeerList extends Component {
    render() {
        let {self, peers} = this.props

        return h('div', {class: 'peer-list'},
            h('ul', {},
                h(PeerListItem, {id: self, self: true}),

                peers.map(id =>
                    h(PeerListItem, {id})
                )
            )
        )
    }
}
