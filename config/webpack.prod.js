const merge = require('webpack-merge');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

const common = require('./webpack.common.js');
const {loader} = require('./shared');

module.exports = merge(common, {
	mode: 'production',
	module: {
		rules: [{
			test: /\.(scss|css)$/,
			use: [
				MiniCssExtractPlugin.loader,
				'css-loader',
				loader.sass,
			]
		}]
	},
	plugins: [
		new MiniCssExtractPlugin(),
	],
});
