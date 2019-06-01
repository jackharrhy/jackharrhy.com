require('dotenv').config();

const {DefinePlugin} = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin');

const {
	path,
	filename,
	loader,
	color,
} = require('./shared');

module.exports = {
	entry: path.jsin,
	output: {
		path: path.out,
		filename: filename.js,
	},
	module: {
		rules: [
			{
				test: /\.(scss|css)$/,
				use: [
					'style-loader',
					'css-loader',
					loader.sass,
				],
			},
			{
				test: /\.js$/,
				exclude: /node_modules/,
				use: {
					loader: 'babel-loader',
				},
			}
		],
	},
	plugins: [
		new CopyWebpackPlugin([{
			from: 'public',
		}]),
		new HtmlWebpackPlugin({
			template: path.htmlin,
		}),
		new DefinePlugin({
			'process.env.SS_PORT': process.env.SS_PORT,
		}),
	],
};
