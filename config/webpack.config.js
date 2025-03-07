const path = require('path')
const webpack = require('webpack')

module.exports = {
  mode: 'production',
  entry: './src/index.ts',
  output: {
    path: path.resolve(__dirname, '../dist/umd'),
    filename: 'index.js',
    library: 'xmtp',
    libraryTarget: 'umd',
    globalObject: 'this',
  },
  module: {
    rules: [
      {
        test: /\.ts(x*)?$/,
        exclude: /node_modules/,
        use: {
          loader: 'ts-loader',
          options: {
            configFile: 'config/tsconfig.umd.json',
          },
        },
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js', '.tsx', '.jsx'],
    fallback: {
      buffer: require.resolve('buffer/'),
      assert: false,
      crypto: false,
      stream: false,
      constants: false,
      fs: false,
      path: false,
      util: false,
    },
  },
  plugins: [
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
    }),
  ],
}
