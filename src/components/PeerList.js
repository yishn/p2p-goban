import {h, Component} from 'preact'
import classnames from 'classnames'
import {getIdentity} from '../helper.js'

class PeerListItem extends Component {
    shouldComponentUpdate(nextProps) {
        return nextProps.id !== this.props.id
            || nextProps.self !== this.props.self
            || nextProps.active !== this.props.active
            || nextProps.highlight !== this.props.highlight
            || nextProps.follow !== this.props.follow
    }

    render() {
        let {
            id, self, active, highlight, follow,
            onClick = () => {}, onFollowClick = () => {}
        } = this.props

        let identity = getIdentity(id)

        return h('li', {class: classnames('peer', {self, active, highlight})},
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
            ),

            !self && h('input', {
                type: 'checkbox',
                checked: follow,
                title: `Follow ${identity.name}`,

                onClick: onFollowClick
            })
        )
    }
}

export default class PeerList extends Component {
    render() {
        let {
            selfId, peerIds, activeIds, highlightIds, followId,
            onPeerClick = () => {}, onFollowClick = () => {}
        } = this.props

        return h('div', {class: 'peer-list'},
            h('ul', {},
                h(PeerListItem, {
                    id: selfId,
                    self: true,
                    active: true
                }),

                peerIds.map(id =>
                    h(PeerListItem, {
                        key: id,
                        id,
                        active: activeIds.includes(id),
                        highlight: highlightIds.includes(id),
                        follow: followId === id,

                        onClick: () => onPeerClick({id}),
                        onFollowClick: () => onFollowClick({id})
                    })
                )
            )
        )
    }
}
