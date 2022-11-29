const path = require('path');

module.exports = {
    mode: 'development',
    entry: './mdeditor.js',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'markdown-editor.js',
        library: "mdeditor",
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /(node_modules)/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env']
                    }
                }
            },
            {
                test: /\.css$/i,
                use: ["style-loader", "css-loader"],
            }
        ]
    },
    performance: {
        hints: false,
        maxEntrypointSize: 2048000,
        maxAssetSize: 2048000
    },
    watchOptions: {
        ignored: /node_modules/
    }
};