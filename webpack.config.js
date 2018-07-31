const path = require("path")
const webpack = require("webpack")

module.exports = {
  entry: "./src/Main.ts",
  target: "web",
  mode: "development",
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"]
  },
  output: {
    filename: "cycle-lot.js",
    path: path.resolve(__dirname, "dist")
  }
}
