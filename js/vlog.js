function animate(id, animation, classOveride) {
	if(classOveride) {
		document.getElementById(id).setAttribute('class', classOveride + ' ' + animation);
	} else {
		document.getElementById(id).setAttribute('class', 'mui-panel link animated '+animation);
	}
	document.getElementById(id).style.visibility = 'visible';
}

function animateBackHome() {
	animate('backHome', 'fadeInDown');
	setTimeout(animateMainContainer, 700);
}
function animateMainContainer() {
	animate('main-container', 'fadeIn', 'mui-container-fluid animated');
}

document.addEventListener("DOMContentLoaded", function(event) {
	window.fitText(document.getElementsByTagName("h1"));
	setTimeout(animateBackHome, 500);
});

function createThumbnailImage(id) {
	var thumb = '<img src="https://i.ytimg.com/vi/ID/hqdefault.jpg">',
	play = '<div class="play"></div>';
	return thumb.replace("ID", id) + play;
}

function replaceThumbWithiFrame() {
	var iframe = document.createElement("iframe");
	var embed = "https://www.youtube.com/embed/ID?autoplay=1";
	iframe.setAttribute("src", embed.replace("ID", this.dataset.id));
	iframe.setAttribute("frameborder", "0");
	iframe.setAttribute("allowfullscreen", "1");
	this.parentNode.replaceChild(iframe, this);
}

function onJSON(data) {
	var vlogDB = JSON.parse(data);
	for(vlog in vlogDB) {
		parent = document.createElement('div');
		parent.id = 'entry';
		parent.setAttribute("class", "mui-panel");

		title = document.createElement("h2");
		title.innerHTML = vlog;

		div = document.createElement("div");
		div.setAttribute("data-id", vlogDB[vlog].key);
		div.innerHTML = createThumbnailImage(vlogDB[vlog].key);
		div.onclick = replaceThumbWithiFrame;

		parent.append(title);
		parent.append(div);
		document.getElementById('main-container').prepend(parent);
	}
}

var xobj = new XMLHttpRequest();
xobj.overrideMimeType("application/json");
xobj.open('GET', 'vlog-db.json', true);
xobj.onreadystatechange = function () {
	if (xobj.readyState == 4 && xobj.status == "200") {
		onJSON(xobj.responseText);
	}
};
xobj.send(null);

(function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
	(i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
	m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
})(window,document,'script','https://www.google-analytics.com/analytics.js','ga');

ga('create', 'UA-89083457-1', 'auto');
ga('send', 'pageview');
