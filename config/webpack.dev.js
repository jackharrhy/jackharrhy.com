const merge = require('webpack-merge');

const common = require('./webpack.common.js');
const {
	path
} = require('./shared');

module.exports = merge(common, {
	mode: 'development',
	devtool: 'inline-source-map',
	devServer: {
		contentBase: path.out,
		compress: true,
		port: 9000,
	}
});
