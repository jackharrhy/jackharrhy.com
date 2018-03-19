var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 10;

var renderer = new THREE.WebGLRenderer();
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0xffffff, 1);
document.body.appendChild(renderer.domElement);

var cubes = [];
var length = 40;

for(var i=0; i<=length; i++) {
  var geometry = new THREE.BoxGeometry(1.2-Math.random(),1.2-Math.random(),1.2-Math.random());
  var material = new THREE.MeshBasicMaterial({ color: randomColor({ hue: 'red' }) });
  var cube = new THREE.Mesh(geometry, material);

  cube.rotation.x += i/10;

  cubes.push(cube);
  scene.add(cubes[cubes.length-1]);
}

function timeout(time, postFunction) {
  setTimeout(postFunction, time);
}

var light = new THREE.AmbientLight(0xffffff);
light.position.z = 0;
scene.add(light);

var frame = -1;
var render = function () {
  frame++;
  renderer.render(scene, camera);

  for(var i=0; i<cubes.length; i++) {
    var cube = cubes[i];

    cube.position.x = Math.sin((frame + (i * Math.PI * 2))/40) * 4;
    cube.position.y = Math.cos((frame + (i * Math.PI * 2))/40) * 4;
    cube.position.z = Math.sin(frame/40 + i/0.5) * 3;
    cube.rotation.x += 0.05;
    cube.rotation.y += 0.05;
  }

  requestAnimationFrame(render);
};

render();

window.addEventListener('resize', function() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}, false);

