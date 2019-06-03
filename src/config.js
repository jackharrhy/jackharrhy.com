const ssEndpoint = process.env.SS_ENDPOINT;
const ssURI = process.env.SS_URI;

let socketServerURI;

if (ssURI === undefined) {
	socketServerURI = `${window.location.protocol === 'https:' ? 'wss://' : 'ws://'}${window.location.host}` + ssEndpoint;
}
else {
	socketServerURI = ssURI;
}

console.log(ssURI);

export default {
	socketServerURI,
};
