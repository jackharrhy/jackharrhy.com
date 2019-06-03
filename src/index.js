import 'normalize.css';
import './styles/main.scss';

import config from './config';

let consoleElem;

const log = (text) => {
	if (text !== '') {
		console.log(text);
	}

	const p = document.createElement('p');
	p.innerHTML = text;
	consoleElem.insertBefore(p, consoleElem.firstChild);
};

window.addEventListener('DOMContentLoaded', async () => {
	consoleElem = document.getElementById('console');
});

const socket = new WebSocket(config.socketServerURI);
socket.onopen = () => console.log(`\u{1F537}`);
socket.onmessage = ({data}) => {
	return data !== '\n' ? data.split('\n').forEach((entry) => log(entry)) : log('&#10240');
};
