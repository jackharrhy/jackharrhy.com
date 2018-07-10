const THREE = require('three');

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();

const clearColor = 0xf9f9f9;

camera.position.z = 10;

renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(clearColor, 1);

const cubes = [];
const amount = 19;

for (let i = 0; i <= amount; i++) {
	const geometry = new THREE.BoxGeometry(1, 1, 1);
	const material = new THREE.MeshBasicMaterial({
		color: 'red'
	});
	const cube = new THREE.Mesh(geometry, material);

	cube.rotation.x += i / 100;

	cubes.push(cube);
	scene.add(cubes[cubes.length - 1]);
}

const light = new THREE.AmbientLight(0xffffff);
light.position.z = 0;
scene.add(light);

let frame = -1;
const render = function () {
	frame += 1;
	renderer.render(scene, camera);

	cubes.forEach(({position, rotation}, i) => {
		position.x = Math.sin((frame / 2 + (i * Math.PI * 2)) / 20) * 6.25;
		position.y = Math.cos((frame / 2 + (i * Math.PI * 2)) / 20) * 6.25;
		position.z = Math.cos(frame / 5 + i) / 3.5;
		rotation.x += 0.05;
		rotation.y += 0.05;
	});

	requestAnimationFrame(render);
};

render();

window.addEventListener('resize', () => {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize(window.innerWidth, window.innerHeight);
}, false);

document.addEventListener('DOMContentLoaded', () => {
	document.body.appendChild(renderer.domElement);
	render();
});
