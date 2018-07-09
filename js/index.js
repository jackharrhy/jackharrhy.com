var clearColor = 0xf9f9f9;

var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 10;

var renderer = new THREE.WebGLRenderer();
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(clearColor, 1);
document.body.appendChild(renderer.domElement);

var cubes = [];
var amount = 19;

for(var i=0; i<=amount; i++) {
  var geometry = new THREE.BoxGeometry(1,1,1);
  var material = new THREE.MeshBasicMaterial({color: 'red'});
  var cube = new THREE.Mesh(geometry, material);

  cube.rotation.x += i/100;

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

    cube.position.x = Math.sin((frame/1.5 + (i * Math.PI * 2))/20) * 6.25;
    cube.position.y = Math.cos((frame/1.5 + (i * Math.PI * 2))/20) * 6.25;
    cube.position.z = Math.cos(frame/5 + i)/3.5;
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

