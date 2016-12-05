document.addEventListener("DOMContentLoaded", function(event) {
	var eyeCatcher = document.getElementById('eyeCatcher');
	var canvas = document.getElementById('canvas');

	var scene = new THREE.Scene();
	var camera = new THREE.PerspectiveCamera(40, eyeCatcher.offsetWidth/eyeCatcher.offsetHeight, 0.1, 1000);

	var renderer = new THREE.WebGLRenderer({ antialias: true });
	renderer.setPixelRatio(window.devicePixelRatio);
	renderer.setSize(eyeCatcher.offsetWidth, eyeCatcher.offsetHeight);
	renderer.setClearColor(0x001024, 1);
	eyeCatcher.appendChild(renderer.domElement);

	window.addEventListener('resize', onWindowResize, false );

	function onWindowResize(){
    camera.aspect = eyeCatcher.offsetWidth/eyeCatcher.offsetHeight;
    camera.updateProjectionMatrix();

		moveBackNum = eyeCatcher.offsetWidth / 175;

    renderer.setSize(eyeCatcher.offsetWidth, eyeCatcher.offsetHeight);
	}

	var cubes = [];

	var moveBackNum = eyeCatcher.offsetWidth / 175;
	var amountOfCubes = 65;

	for(var i=0; i<amountOfCubes; i++) {
		cubes[i] = {
			geo: new THREE.BoxGeometry(0.1, 1, 1),
			mat: new THREE.MeshPhongMaterial({ color: 0xb1c7d6 })
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

		for(var i=0; i<amountOfCubes; i++) {
			if((i * 25) < frame) {
				var cube = cubes[i];

				cube.mesh.position.x += 0.01;

				if(cube.mesh.position.x > moveBackNum) {
					cube.mesh.position.x *= -1;
				}
				cube.mesh.position.z += Math.sin(frame/50 + i)/250;
			}
		}

		renderer.render(scene, camera);

		requestAnimationFrame(render);
	};
	render();
});
