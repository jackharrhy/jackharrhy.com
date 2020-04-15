import * as THREE from 'three';
import * as dat from 'dat.gui';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer();
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0xffffff, 1);

const parent = new THREE.Object3D();

scene.add(parent);

const cubes = [];

const cubeSize = 1;
const realCubeSizeModifier = 0.5;
const realCubeSize = cubeSize * realCubeSizeModifier;

const cubeGeo = new THREE.BoxGeometry(realCubeSize, realCubeSize, realCubeSize);

camera.position.z = 35;
camera.position.y = 10;

const light = new THREE.AmbientLight(0xffffff);
light.position.z = 2;
scene.add(light);

const modifier = {
	initialThin: 10,
	outerThin: 75,
	dataMulti: 0,
	zMulti: 700,
};

const gui = new dat.GUI();
gui.add(modifier, 'initialThin', 0, 100);
gui.add(modifier, 'outerThin', 0, 100);
gui.add(modifier, 'dataMulti', -1.5, 1.5);
gui.add(modifier, 'zMulti', -2000, 2000);

let frame = -1;

function loop(ctx) {
	let {canvas, analyser, frequencyData} = ctx;
	frame += 1;
	analyser.getByteFrequencyData(frequencyData);

	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;

	const dimension = Math.sqrt(frequencyData.length);
	parent.rotation.y += 0.005;

	for (let i = 0; i < frequencyData.length; i++) {
		const cube = cubes[i];

		const level = (Math.floor(i / dimension));
		const xTarget = i * cubeSize;
		const xOffset = level * (cubeSize * dimension);
		const halfOffset = (cubeSize * 32) / 2;
		cube.position.x = (xTarget - xOffset) - halfOffset;
		cube.position.z = (level - halfOffset);

		const data = frequencyData[i] / 255;
		const sinOffset = Math.sin((frame + i) / (modifier.initialThin + (data * modifier.dataMulti))) / modifier.outerThin;
		cube.position.y = sinOffset * (data * modifier.zMulti);
		cube.material.opacity = cube.position.y > 0 ? data : 0;
	}

	if (frame === 50) {
		console.log(cubes)
	}
	requestAnimationFrame(loop.bind(this, ctx));
	renderer.render(scene, camera);
}

const init = (ctx) => {
	const {frequencyData} = ctx;
	document.body.appendChild(renderer.domElement);

	for (let i = 0; i < frequencyData.length; i++) {
		const material = new THREE.MeshPhongMaterial({color: 0x111111});
		const cube = new THREE.Mesh(cubeGeo, material);
		cubes[i] = cube;
		cube.material.transparent = true;
		parent.add(cubes[i]);
	}

	loop(ctx);
};

export {init};
