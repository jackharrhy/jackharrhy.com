console.log('[0] Button starting... :3000');

var buttonCount;
var prevButtonCount;

var fs = require('fs');

fs.readFile('./count', 'utf8', function(err,data) {
	if(err) throw err;

	buttonCount = parseInt(data);
});

function logClicks() {
	if(buttonCount && buttonCount !== prevButtonCount) {
		fs.writeFile('count', String(buttonCount), function(err) {
			if(err) throw err;
			console.log('[/] Wrote "' + String(buttonCount) + '" to "./count"');
			prevButtonCount = buttonCount;
		});
	}
	setTimeout(logClicks, 60000);
}
setTimeout(logClicks, 5000);

var io = require('socket.io')(3000);

io.sockets.on('connection', function(socket) {
	console.log('[=] Socket "' + socket.handshake.headers.host + '" connected');

	io.emit('new socket', buttonCount);

	socket.on('click', function() {
		buttonCount++;
		console.log('[@] ' + String(buttonCount) + ' Click(s)!');
		io.emit('click', buttonCount);
	});
});
