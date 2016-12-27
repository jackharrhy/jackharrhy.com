function animate(id, animation) {
	document.getElementById(id).setAttribute('class', 'mui-panel link animated '+animation);
	document.getElementById(id).style.visibility = 'visible';
}

function animateVlog() {
	animate('vlog', 'fadeInDown');
	setTimeout(animateEmail, 300);
}
function animateEmail() {
	animate('email', 'fadeInDown');
	setTimeout(animateGithub, 300);
}
function animateGithub() {
	animate('github', 'fadeInDown');
}

document.addEventListener("DOMContentLoaded", function(event) {
	window.fitText(document.getElementsByTagName("h1"));

	setTimeout(animateVlog, 600);
});

(function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
(i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
})(window,document,'script','https://www.google-analytics.com/analytics.js','ga');

ga('create', 'UA-89083457-1', 'auto');
ga('send', 'pageview');
