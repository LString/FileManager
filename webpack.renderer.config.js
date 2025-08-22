const path = require('path');

module.exports = {
    target: 'electron-renderer',
    entry: {
        login: './src/renderer/loginWindow/login.js' , // 如果有多个入口需要分别配置
        main: './src/renderer/mainWindow/mainWindow.js'
    },
    output: {
        path: path.resolve(__dirname, '.webpack/renderer'),
        filename: '[name].bundle.js',
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env']
                    }
                }
            }
        ]
    }
};