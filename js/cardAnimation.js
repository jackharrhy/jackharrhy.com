/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, {
/******/ 				configurable: false,
/******/ 				enumerable: true,
/******/ 				get: getter
/******/ 			});
/******/ 		}
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
Object.defineProperty(__webpack_exports__, "__esModule", { value: true });
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__numToCard__ = __webpack_require__(1);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1__cardToNum__ = __webpack_require__(2);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2__cardURLs__ = __webpack_require__(3);
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2__cardURLs___default = __webpack_require__.n(__WEBPACK_IMPORTED_MODULE_2__cardURLs__);




var cardPrefix = "cards/";

function randInt(min, max) {
  return Math.floor(Math.random() * max) + min;
}

function vec3(x, y, z) {
  return { x: x, y: y, z: z };
}

function transformObj(obj, pos, posTime, rot, rotTime) {
  obj.rot = { x: obj.obj.rotation.x, y: obj.obj.rotation.y, z: obj.obj.rotation.z };
  obj.tween.rot = new TWEEN.Tween(obj.rot).to(rot, rotTime);
  obj.tween.rot.onUpdate(function () {
    obj.obj.rotation.x = obj.rot.x;
    obj.obj.rotation.y = obj.rot.y;
    obj.obj.rotation.z = obj.rot.z;
  });
  obj.tween.rot.easing(TWEEN.Easing.Quadratic.InOut)
  obj.tween.rot.start();

  obj.tween.rot.active = true;
  setTimeout(function () {
    obj.tween.rot.active = false;
  }, rotTime)

  obj.pos = { x: obj.obj.position.x, y: obj.obj.position.y, z: obj.obj.position.z };
  obj.tween.pos = new TWEEN.Tween(obj.pos).to(pos, posTime);
  obj.tween.pos.onUpdate(function () {
    obj.obj.position.x = obj.pos.x;
    obj.obj.position.y = obj.pos.y;
    obj.obj.position.z = obj.pos.z;
  });
  obj.tween.pos.easing(TWEEN.Easing.Quadratic.InOut)
  obj.tween.pos.start();

  obj.tween.pos.active = true;
  setTimeout(function () {
    obj.tween.pos.active = false;
  }, posTime)
}

var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 6;

var renderer = new THREE.WebGLRenderer();
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x003831, 1);
document.body.appendChild(renderer.domElement);

var cards = [];

var state = {
  swirl: {
    init: function() {
      stateChangeAfterDelay(2000, state.swirl);
      forEachCard(function(i) {
        action.center(1750);
      });
    },
    pos: function(obj, i) {
      if(!obj.vars.delay) {
        obj.obj.position.x += (Math.cos(frame / 50 - i / 1.2 + Math.random() / 10) / 20);
        obj.obj.position.y -= (Math.sin(frame / 50 - i / 1.2 + Math.random() / 10) / 25);
        obj.obj.position.z += (Math.sin(frame / 50 - i / 2) / 30);
      } else {
        obj.vars.delay -= 1;
        if(obj.vars.delay <= 0) {
          delete obj.vars.delay;
        }
      }
    },
    rot: function(obj, i) {
      if(!obj.vars.delay) {
        obj.obj.rotation.y += (Math.cos(frame / 100 + i / 10) / 40);
        obj.obj.rotation.z += (Math.cos(frame / 100 + i / 10) / 50);
        obj.obj.rotation.x += (Math.cos(frame / 100 + i / 10) / 60);
      }
    }
  },
  static: {
    init: function() { randomState(); },
    pos: function(obj, i) { },
    rot: function(obj, i) { }
  }
};

var packGeometry = new THREE.BoxGeometry(0.8125, 1.25, 0.03);
var packTexture = new THREE.TextureLoader().load(cardPrefix + 'pack.png');
var pack = {
  material: new THREE.MeshPhongMaterial({ color: 0xffffff, map: packTexture })
};
pack.obj = new THREE.Mesh(packGeometry, pack.material);
pack.obj.position.z = 5;
scene.add(pack.obj);
pack.tween = {
  pos: { active: false },
  rot: { active: false }
};
pack.state = state.static;

var isInitialAnimationOver = false;

function forEachCard(cb) {
  for (var i = 0; i < 52; i++) {
    cb(i);
  }
}

function stateChangeAfterDelay(delay, state) {
  forEachCard(function(i) {
    cards[i].state = state;
  });
}

var action = {
  center: function(time) {
    forEachCard(function(i) {
      transformObj(cards[i],
        vec3(0,0,i/52), time - 250,
        vec3(0,0,0), time
      );
    });
  },
  spread: function(time) {
    forEachCard(function(i) {
      transformObj(cards[i],
        vec3(i/7 - 3.5,Math.sin(i / (26/Math.PI)),i/52), time,
        vec3(0,0,(Math.PI/1.5) + i/24.8407), time - 500
      );
    });
  }
}

function timeout(time, postFunction) {
  setTimeout(postFunction, time);
}

timeout(1250, function() {
  transformObj(pack,
    vec3(0,0,0.5), 1000,
    vec3(0,0,0), 1000
  );

  timeout(1000, function() {
    transformObj(pack,
      vec3(0,-35,0), 3000,
      vec3(Math.PI/3,0,0),3000,
    );

    action.spread(5000);

    timeout(5000, function() {
      action.center(1500);

      timeout(1500, function() {
        forEachCard(function(i) {
          cards[i].vars.delay = i * 10;
          cards[i].state = state.swirl;
          isInitialAnimationOver = true;
        });
      });
    });
  });
});

var cardGeometry = new THREE.BoxGeometry(0.65, 1, 0.03);
for (var i = 0; i < 52; i++) {
  var cardDes = Object(__WEBPACK_IMPORTED_MODULE_0__numToCard__["a" /* default */])(i);
  var cardTexture = new THREE.TextureLoader().load(cardPrefix + __WEBPACK_IMPORTED_MODULE_2__cardURLs___default.a[cardDes[0]][i - cardDes[1]]);

  cards[i] = {
    material: new THREE.MeshPhongMaterial({ color: 0xffffff, map: cardTexture })
  };
  cards[i].obj = new THREE.Mesh(cardGeometry, cards[i].material);
  cards[i].tween = {
    pos: { active: false },
    rot: { active: false }
  };
  cards[i].state = state.static;
  cards[i].vars = {};

  scene.add(cards[i].obj);
}

var light = new THREE.AmbientLight(0xffffff);
light.position.z = 5;
scene.add(light);

var frame = -1;
var render = function () {
  frame++;
  renderer.render(scene, camera);

  requestAnimationFrame(render);

  if(!pack.tween.pos.active) {
    pack.state.pos(pack, 0);
  }
  if(!pack.tween.rot.active) {
    pack.state.rot(pack, 0);
  }

  forEachCard(function (i) {
    if(!cards[i].tween.pos.active) {
      cards[i].state.pos(cards[i], i);
    }

    if(!cards[i].tween.rot.active) {
      cards[i].state.rot(cards[i], i);
    }
  });

  TWEEN.update();
};

render();

window.addEventListener('resize', function() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}, false);


/***/ }),
/* 1 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export (immutable) */ __webpack_exports__["a"] = numToCard;
function numToCard(i) {
  var suit;
  var toTake = 0;
  if(i < 13) {
    suit = 'clubs';
  } else if(i < 26) {
    suit = 'diamonds';
    toTake = 13;
  } else if(i < 39) {
    suit = 'hearts';
    toTake = 26;
  } else {
    suit = 'spades';
    toTake = 39;
  }

  return [suit, toTake];
}



/***/ }),
/* 2 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* unused harmony export default */
function cardToNum(suit, num) {
  var toAdd = 0;
  if(suit === 'diamonds') {
    toAdd = 13;
  } else if(suit === 'hearts') {
    toAdd = 26;
  } else if(suit === 'spades') {
    toAdd = 39;
  }

  return toAdd + parseInt(num);
}

/***/ }),
/* 3 */
/***/ (function(module, exports) {

module.exports = {
	clubs: [
		"ace_of_clubs.png",
		"2_of_clubs.png",
		"3_of_clubs.png",
		"4_of_clubs.png",
		"5_of_clubs.png",
		"6_of_clubs.png",
		"7_of_clubs.png",
		"8_of_clubs.png",
		"9_of_clubs.png",
		"10_of_clubs.png",
		"jack_of_clubs.png",
		"queen_of_clubs.png",
		"king_of_clubs.png"
	],
	diamonds: [
		"ace_of_diamonds.png",
		"2_of_diamonds.png",
		"3_of_diamonds.png",
		"4_of_diamonds.png",
		"5_of_diamonds.png",
		"6_of_diamonds.png",
		"7_of_diamonds.png",
		"8_of_diamonds.png",
		"9_of_diamonds.png",
		"10_of_diamonds.png",
		"jack_of_diamonds.png",
		"queen_of_diamonds.png",
		"king_of_diamonds.png"
	],
	hearts: [
		"ace_of_hearts.png",
		"2_of_hearts.png",
		"3_of_hearts.png",
		"4_of_hearts.png",
		"5_of_hearts.png",
		"6_of_hearts.png",
		"7_of_hearts.png",
		"8_of_hearts.png",
		"9_of_hearts.png",
		"10_of_hearts.png",
		"jack_of_hearts.png",
		"queen_of_hearts.png",
		"king_of_hearts.png"
	],
	spades: [
		"ace_of_spades.png",
		"2_of_spades.png",
		"3_of_spades.png",
		"4_of_spades.png",
		"5_of_spades.png",
		"6_of_spades.png",
		"7_of_spades.png",
		"8_of_spades.png",
		"9_of_spades.png",
		"10_of_spades.png",
		"jack_of_spades.png",
		"queen_of_spades.png",
		"king_of_spades.png"
	]
};


/***/ })
/******/ ]);