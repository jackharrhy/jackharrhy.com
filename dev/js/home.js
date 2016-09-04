(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
document.addEventListener("DOMContentLoaded", function (event) {
	var eyeCatcher = document.getElementById('eyeCatcher');
	var canvas = document.getElementById('canvas');

	var scene = new THREE.Scene();
	var camera = new THREE.PerspectiveCamera(40, eyeCatcher.offsetWidth / eyeCatcher.offsetHeight, 0.1, 1000);

	var renderer = new THREE.WebGLRenderer({ antialias: true });
	renderer.setPixelRatio(window.devicePixelRatio);
	renderer.setSize(eyeCatcher.offsetWidth, eyeCatcher.offsetHeight);
	renderer.setClearColor(0xf7f7f5, 1);
	eyeCatcher.appendChild(renderer.domElement);

	window.addEventListener('resize', onWindowResize, false);

	function onWindowResize() {
		camera.aspect = eyeCatcher.offsetWidth / eyeCatcher.offsetHeight;
		camera.updateProjectionMatrix();

		moveBackNum = eyeCatcher.offsetWidth / 175;

		renderer.setSize(eyeCatcher.offsetWidth, eyeCatcher.offsetHeight);
	}

	var cubes = [];

	var moveBackNum = eyeCatcher.offsetWidth / 175;
	var amountOfCubes = 30;

	for (var i = 0; i < amountOfCubes; i++) {
		cubes[i] = {
			geo: new THREE.BoxGeometry(1, 1, 1),
			mat: new THREE.MeshPhongMaterial({ color: "rgb(255," + String(Math.floor(i * 255 / amountOfCubes)) + "," + String(Math.floor(i * 255 / amountOfCubes)) + ")" })
		};
		cubes[i].mesh = new THREE.Mesh(cubes[i].geo, cubes[i].mat);
		scene.add(cubes[i].mesh);

		cubes[i].mesh.position.x = moveBackNum;
		cubes[i].mesh.position.z = -3;
	}

	var dirLight = new THREE.DirectionalLight(0xffffff, 1);
	dirLight.color.setHSL(0.1, 1, 0.95);
	dirLight.position.set(-1, 1.75, 1);
	dirLight.position.multiplyScalar(50);
	dirLight.castShadow = true;
	scene.add(dirLight);

	var light = new THREE.AmbientLight(0xe3e3e3);
	light.position.y = 5;
	scene.add(light);

	var frame = -1;
	var render = function () {
		frame++;

		for (var i = 0; i < amountOfCubes; i++) {
			if (i * 25 < frame) {
				var cube = cubes[i];

				cube.mesh.position.x += 0.01;

				if (cube.mesh.position.x > moveBackNum) {
					cube.mesh.position.x *= -1;
				}
				cube.mesh.position.z += Math.sin(frame / 50) / 250;

				cube.mesh.rotation.x += 0.004;
				cube.mesh.rotation.y += 0.004;
			}
		}

		renderer.render(scene, camera);

		requestAnimationFrame(render);
	};
	render();
});

},{}]},{},[1])


//# sourceMappingURL=home.js.map
