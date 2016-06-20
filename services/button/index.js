var winston = require('winston');

winston.add(winston.transports.File, { filename: 'button.log' });

winston.info('startup', new Date().toString());

var buttonCount, prevButtonCount;

var fs = require('fs');
fs.readFile('./button-count.txt', 'utf8', function(err,data) {
	if(err) throw err;
	buttonCount = parseInt(data);
});

function logClicks() {
	if(buttonCount && buttonCount !== prevButtonCount) {
		fs.writeFile('./button-count.txt', String(buttonCount), function(err) {
			winston.info('loggedclick', buttonCount.toString());
			if(err) throw err;
			prevButtonCount = buttonCount;
		});
	}
	setTimeout(logClicks, 10000);
}
logClicks();

var io = require('socket.io')(9191);
io.sockets.on('connection', function(socket) {
	winston.info('socket', socket);

	io.emit('new socket', buttonCount);

	socket.on('click', function() {
		buttonCount++;
		winston.info('increment', buttonCount);
		io.emit('click', buttonCount);
	});
});
