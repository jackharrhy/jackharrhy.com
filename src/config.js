const socketServerURI = `${window.location.protocol === 'https:' ? 'wss://' : 'ws://'}${window.location.host}` + process.env.SS_ENDPOINT;

export default {
	socketServerURI,
};
