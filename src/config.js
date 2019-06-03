const ssEndpoint = process.env.SS_ENDPOINT;
const ssURI = process.env.SS_URI;

const isValidUrl = (string) => {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
};

let socketServerURI;

if (!isValidUrl(ssURI)) {
	socketServerURI = `${window.location.protocol === 'https:' ? 'wss://' : 'ws://'}${window.location.host}` + ssEndpoint;
}
else {
	socketServerURI = ssURI;
}

export default {
	socketServerURI,
};
