var socket = io({ path: '/serv/button/socket.io' });

var buttonCount;
var sessionCount = 0;
var userCount = 0;

function click() {
	socket.emit('click');
	console.log('click');
}

function update(num, domElement) {
	document.getElementById(domElement).innerHTML = String(num);
}

socket.on('new socket', function(count) {
	buttonCount = count;

	update(buttonCount, 'counter');
	update(sessionCount, 'session');
	update(userCount, 'user');
});

socket.on('click', function(count) {
	buttonCount = count;
	sessionCount++;

	update(buttonCount, 'counter');
	update(sessionCount, 'session');
});
