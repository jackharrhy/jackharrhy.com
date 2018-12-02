require('dotenv').config();

const path = require('path');

const rel = (suffix) => path.resolve(__dirname, '..', suffix);

const color = {
	CLEARCOLOR: process.env.CLEARCOLOR,
	COLOR1: process.env.COLOR1,
	COLOR2: process.env.COLOR2,
	COLOR3: process.env.COLOR3,
};

let sassString = '';
Object.entries(color).forEach((e) => sassString += `$${e[0]}: ${e[1]};`);

module.exports = {
	color,
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
			options: {data: sassString},
		}
	}
};
