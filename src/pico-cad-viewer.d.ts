declare class PicoCADViewer {
	constructor(options: {
		canvas: HTMLElement;
		fov: number;
		resolution: { width: number; height: number };
	});
	load(data: string): void;
	startDrawLoop(callback: (dt: number) => void): void;
	setTurntableCamera(
		distance: number,
		angle: number,
		aspect: number,
		position: { x: number; y: number; z: number }
	): void;
	setLightDirectionFromCamera(): void;
}

export default PicoCADViewer;
