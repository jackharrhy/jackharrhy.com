import 'normalize.css';
import './styles/main.scss';

let consoleElem;

const log = (text) => {
	console.log(text);
	const p = document.createElement('p');
	p.innerHTML = text;
	consoleElem.insertBefore(p, consoleElem.firstChild);
};

window.addEventListener('DOMContentLoaded', async () => {
	consoleElem = document.getElementById('console');
});

const socket = new WebSocket('ws://0.0.0.0:3000');
socket.onopen = () => console.log(`\u{1F537}`);
socket.onmessage = ({data}) => {
	return data !== '\n' ? data.split('\n').forEach((entry) => log(entry)) : log('&#10240');
};
