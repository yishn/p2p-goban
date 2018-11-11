import {h, Component} from 'preact'
import classnames from 'classnames'

export default class ChatBox extends Component {
    constructor(props) {
        super(props)

        this.state = {
            chatInput: ''
        }
    }

    handleSubmit(evt) {
        evt.preventDefault()
        if (this.state.chatInput.trim() === '') return

        let {onSubmit = () => {}} = this.props
        onSubmit({value: this.state.chatInput})

        this.setState({chatInput: ''})
    }

    componentDidUpdate(prevProps) {
        if (prevProps.chat !== this.props.chat) {
            this.scrollElement.scrollTop = this.scrollElement.scrollHeight
        }
    }

    render() {
        let {chat, author} = this.props

        return h('div', {class: 'chat-box'},
            h('ol', {ref: el => this.scrollElement = el, class: 'chat-log'}, chat.map((entry, i) =>
                h('li', {},
                    (i === 0 || chat[i - 1].from !== entry.from) && h('strong', {
                        class: classnames('from', {
                            me: author === entry.from
                        })
                    }, entry.from.slice(0, 8)), ' ',

                    h('span', {class: 'value'}, entry.value)
                )
            )),

            h('form', {class: 'chat-input', onSubmit: this.handleSubmit.bind(this)},
                h('input', {
                    placeholder: 'Chat',
                    value: this.state.chatInput,
                    onInput: evt => this.setState({chatInput: evt.currentTarget.value})
                })
            )
        )
    }
}
