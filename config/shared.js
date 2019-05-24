const path = require('path');

const rel = (suffix) => path.resolve(__dirname, '..', suffix);

module.exports = {
	path: {
		htmlin: rel('public/index.html'),
		jsin: rel('src/index.js'),
		out: rel('build'),
	},
	filename: {
		js: 'bundle.js',
	},
	loader: {
		sass: {
			loader: 'sass-loader',
		}
	}
};
