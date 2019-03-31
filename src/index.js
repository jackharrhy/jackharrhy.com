import * as THREE from 'three';

import 'normalize.css';
import './styles/main.scss';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({antialias: true});

const clearColor = CLEARCOLOR;

camera.position.z = 10;

renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(clearColor, 1);

const objects = [];
for (let a = 0; a <= 18; a++) {
	for (let b = 0; b <= 13; b++) {
		const geometry = new THREE.TorusGeometry(0.6, 0.2, 10, 6);
		const material = new THREE.MeshLambertMaterial({
			color: COLOR1
		});

		const object = new THREE.Mesh(geometry, material);

		object.data = {a,b};
		objects.push(object);
		scene.add(objects[objects.length - 1]);
	}
}

const light = new THREE.AmbientLight(0xffffff);
light.position.z = 0;
scene.add(light);

let frame = -1;

const settings = {
	inc: true,
};

const render = function () {
	frame += settings.inc ? 1 : 0;
	renderer.render(scene, camera);

	objects.forEach(({position, rotation, data: {a, b}}) => {
		position.y = Math.sin(frame/100) + (b * 2 - objects.length/20);
		position.x = a * 2 - objects.length/15.6;
		rotation.y += Math.sin((frame + a * 100)/100)/1000;
		rotation.x += Math.cos((frame + b * 125)/100)/500;
		rotation.z += Math.cos((frame + a * 150)/100)/400;
	});

	requestAnimationFrame(render);
};

window.addEventListener('resize', () => {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize(window.innerWidth, window.innerHeight);
}, false);

document.addEventListener('DOMContentLoaded', () => {
	document.body.appendChild(renderer.domElement);
	render();
});

function parseMessage(message) {
	if (message.nc  === 'true' || message.inc === true) {
		settings.inc = true;
	}
	else if (message.inc === 'false' || message.inc === false) {
		settings.inc = false;
	}
}

const socket = new WebSocket(WEBSOCKETSERVER);

socket.onopen = (event) => console.log(`\u{1F537}`);

socket.onmessage = (data) => {
	try {
		const message = JSON.parse(data.data);
		parseMessage(message);
	}
	catch(e) {
		console.error(e);
	}
};
