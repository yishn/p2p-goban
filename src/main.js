import {h, render} from 'preact'
import App from './components/App.js'

render(
    h(App, {ref: component => window.App = component}),
    document.getElementById('root')
)
