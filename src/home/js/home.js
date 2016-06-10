var clearColor = document.body.style.backgroundColor;
var canvas = document.getElementById('canvas');
var c = canvas.getContext('2d');
var cursorX;

document.onmousemove = function(e) {
	cursorX = e.pageX / 2;
	// ^ crude fix right here :(
}

canvas.height = 100;

var frame = -1;
function loop() {
	frame += 1;
	canvas.width = window.innerWidth;

	c.clearRect(0,0,canvas.width,canvas.height);

	for(var i=0; i<=window.innerWidth/2; i++) {
		c.fillStyle = 'rgba('+
			String(Math.ceil(Math.sin(frame/4 + i/2)*100) + 155)+','+
			String(Math.ceil(Math.cos(frame/5 + i/2.5)*100) + 155)+','+
			String(Math.ceil(Math.sin(frame/6 + i/3)*100) + 155)+','+
			String(1)+')';

		if(i-50 < cursorX && i+50 > cursorX) {
			var grad = ((cursorX - i) - 50) * -1;

			if(grad > 50) {
				mod = (grad - 100) * -1;
			} else {
				mod = grad;
			}

			c.fillRect(
				i * 2,
				50 +
					(Math.cos((frame+i)/60)*30)*
					Math.sin((frame-i)/30)-
					(Math.sin(frame+i))*mod/3,
				2,
				2);

		} else {
			c.fillRect(
				i * 2,
				50 +
					(Math.cos((frame+i)/60)*30)*
					Math.sin((frame-i)/30)+
					Math.cos((frame+i))/10,
				2,
				2);
		}
	}

	requestAnimationFrame(loop);
}
loop();
