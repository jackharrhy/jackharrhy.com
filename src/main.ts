import "./style.css";
import "@fortawesome/fontawesome-free/css/all.css";

import PicoCADViewer from "./pico-cad-viewer";

import cuppa from "./cuppa.txt?raw";

const canvas = document.getElementById("canvas");

if (canvas === null) throw new Error("no canvas!");

const viewer = new PicoCADViewer({
	canvas,
	fov: 18,
	resolution: { width: 256, height: 140 },
});

viewer.load(cuppa);

let spin = 0;

viewer.startDrawLoop((dt) => {
	spin += dt;
	viewer.setTurntableCamera(8, spin, 0.1, { x: 0, y: 0.65, z: 0 });
	viewer.setLightDirectionFromCamera();
});
