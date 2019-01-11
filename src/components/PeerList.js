import {h, Component} from 'preact'
import classnames from 'classnames'
import {getIdentity} from '../helper.js'

class PeerListItem extends Component {
    render() {
        let {id, self} = this.props
        let identity = getIdentity(id)

        return h('li', {class: classnames({self})},
            h('div', {
                class: 'color',
                style: {
                    background: `rgb(${identity.color.join(',')})`
                }
            }), ' ',

            h('span', {class: 'name'}, identity.name)
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
