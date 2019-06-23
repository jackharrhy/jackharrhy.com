import 'normalize.css';
import './styles/main.scss';

import config from './config';

let consoleElem;
const chat = {};

const wsStates = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'];

const log = (text) => {
	if (text !== '') {
		console.log(text);
	}

	const p = document.createElement('p');
	p.innerHTML = text;
	consoleElem.insertBefore(p, consoleElem.firstChild);
};

const sendMessage = () => {
	if (wsStates[socket.readyState] !== 'OPEN') {
		chat.hide();
	}
	socket.send(chat.input.value);
	chat.input.value = '';
};

const socket = new WebSocket(config.socketServerURI);
const onOpen = () => {
	chat.show();
	console.log(`\u{1F537}`);
};
const onError = () => {
	console.log(`\u{1F537}`);
};

const newMessage = ({data: rawData}) => {
	const {type, message} = JSON.parse(rawData);

	if (type === 'log') {
		message.split('\n').forEach((entry) => log(entry));
		if (message === '\n') {
			log('&#10240');
		}
	}
	else if (type === 'message' || type === 'self') {
		const chatMessage = document.createElement('p');
		chatMessage.className = type === 'self' ? 'self' : 'them';
		chatMessage.innerHTML = message;
		chat.container.insertBefore(chatMessage, chat.container.firstChild);
	}
};

window.addEventListener('DOMContentLoaded', async () => {
	consoleElem = document.getElementById('console');
	chat.self = document.getElementById('chat');
	chat.container = document.getElementById('chat-container');
	chat.input = document.getElementsByTagName('input')[0];
	chat.button = document.getElementsByTagName('button')[0];

	chat.hide = () => {
		chat.self.style.opacity = '0.3';
		chat.self.style.pointerEvents = 'none';
	};
	chat.show = () => {
		chat.self.style.opacity = '1';
		chat.self.style.pointerEvents = 'all';
	};

	socket.onopen = onOpen;
	socket.onmessage = newMessage;
	socket.onerror = onError;

	chat.button.onclick = sendMessage;
	chat.input.onkeypress = (e) => {
		if (e.key === 'Enter') {
			sendMessage();
			return false;
		}
	};
});
