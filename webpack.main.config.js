// webpack.main.config.js
const path = require("path");

module.exports = {
  entry: "./src/main/main.js", // 主进程入口文件路径
  target: "electron-main",
  output: {
    path: path.resolve(__dirname, ".webpack/main"),
    filename: "main.js"
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-env"]
          }
        }
      }
    ]
  }
};