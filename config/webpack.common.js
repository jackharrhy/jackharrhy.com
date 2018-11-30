const CopyWebpackPlugin = require('copy-webpack-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin');

const {
	paths,
	filename
} = require('./paths');

module.exports = {
	entry: paths.jsin,
	output: {
		path: paths.out,
		filename: filename.js,
	},
	module: {
		rules: [
			{
				test: /\.(scss|css)$/,
				use: [
					'style-loader',
					'css-loader',
					'sass-loader',
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
			template: paths.htmlin,
		}),
	],
};
