//@ts-check

'use strict';

const path = require('path');

//@ts-check
/** @typedef {import('webpack').Configuration} WebpackConfig **/

/** @type WebpackConfig */
const extensionConfig = {
  target: 'node',
	mode: 'none',
  entry: './src/extension.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2'
  },
  externals: {
    vscode: 'commonjs vscode'
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              transpileOnly: true, // 跳过类型检查，大幅提升编译速度
              experimentalWatchApi: true, // 使用实验性的 watch API，提升 watch 模式性能
            }
          }
        ]
      }
    ]
  },
  devtool: 'nosources-source-map',
  infrastructureLogging: {
    level: "log",
  },
  // 启用缓存，大幅提升二次编译速度
  cache: {
    type: 'filesystem',
    buildDependencies: {
      config: [__filename]
    }
  },
  // 性能优化
  optimization: {
    minimize: false, // 开发模式不压缩，加快构建速度
  },
  // 监听优化
  watchOptions: {
    ignored: /node_modules/,
    aggregateTimeout: 200, // 延迟重新构建的时间
  }
};
module.exports = [ extensionConfig ];