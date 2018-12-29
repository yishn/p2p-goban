const path = require('path')

module.exports = (env, argv) => ({
    entry: './src/main.js',

    output: {
        filename: 'bundle.js',
        path: path.join(__dirname, 'dist')
    },

    devtool: argv.mode === 'production' ? false : 'cheap-module-eval-source-map',
    target: 'web',

    externals: {
        'fs': 'null',
        'jschardet': 'null',
        'iconv-lite': 'null'
    }
})
