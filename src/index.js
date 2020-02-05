import 'normalize.css';
import './styles/main.scss';
import {init} from './visualizer';

window.addEventListener('DOMContentLoaded', async () => {
	const audioContext = new (window.AudioContext || window.webkitAudioContext)();
	const audio = document.getElementById('audio');
	const canvas = document.getElementById('canvas');

	const audioSrc = audioContext.createMediaElementSource(audio);
	const analyser = audioContext.createAnalyser();
	const frequencyData = new Uint8Array(analyser.frequencyBinCount);
	audioSrc.connect(analyser);
	analyser.connect(audioContext.destination);

	document.getElementById('player').style.opacity = 1;
	document.getElementById('player').addEventListener('click', () => {
		document.getElementsByTagName('header')[0].style.display = 'none';
		init({frequencyData, canvas, analyser});
		audio.play();
	});
});
