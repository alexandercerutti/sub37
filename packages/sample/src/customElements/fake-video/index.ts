import "./controls";
import { Controls } from "./controls";

const currentTimeSymbol = Symbol("currentTime");
const durationSymbol = Symbol("duration");

export class FakeHTMLVideoElement extends HTMLElement {
	static get observedAttributes() {
		return ["controls"];
	}

	private playheadInterval: number | undefined;
	private [currentTimeSymbol]: number = 0;
	private [durationSymbol]: number = 0;

	public constructor() {
		super();

		this.attachShadow({ mode: "open" });

		const style = document.createElement("style");
		style.textContent = `
:host {
	height: 100%;
	width: 100%;
	position: absolute;
	z-index: 10;
}
		`;

		console.log("controls:", this.getAttribute("controls"));
		this.shadowRoot.append(style);

		this.updateControlsView(this.hasAttribute("controls"));
	}

	public attributeChangedCallback(name: string, oldValue: string, newValue: string) {
		if (name === "controls") {
			this.updateControlsView(typeof newValue === "string");
			return;
		}
	}

	private updateControlsView(viewWillBecomeVisible: boolean) {
		let controlsView = this.shadowRoot.querySelector("controls-skin") as Controls;

		if (viewWillBecomeVisible) {
			if (controlsView) {
				return;
			}

			controlsView = document.createElement("controls-skin") as Controls;
			this.shadowRoot.appendChild(controlsView);

			controlsView.controllers = {
				onPlaybackStatusChange: (status) => {
					if (status === "PLAY") {
						this.play();
					} else {
						this.pause();
					}
				},
				onSeek: (currentTime) => {
					this.currentTime = currentTime;
					this.dispatchEvent(new Event("seeked"));
				},
			};

			if (this.playheadInterval) {
				controlsView.play();
			} else {
				controlsView.pause();
			}

			return;
		}

		controlsView = this.shadowRoot.querySelector("controls-skin") as Controls;
		controlsView?.remove();
	}

	public get currentTime(): number {
		return this[currentTimeSymbol];
	}

	public set currentTime(value: number) {
		this[currentTimeSymbol] = Math.min(Math.max(0, value), this[durationSymbol]);
		const events: Event[] = [new Event("seeked"), new Event("timeupdate")];

		for (const event of events) {
			this.dispatchEvent(event);
		}
	}

	public get duration(): number {
		return this[durationSymbol];
	}

	public set duration(value: number) {
		this[durationSymbol] = value;
	}

	public get paused() {
		return this.playheadInterval === undefined;
	}

	public play() {
		if (this.playheadInterval) {
			window.clearInterval(this.playheadInterval);
			this.playheadInterval = undefined;
		}

		this.playheadInterval = window.setInterval(() => {
			const controlsView = this.shadowRoot.querySelector("controls-skin") as Controls;

			const event = new Event("timeupdate");
			this.dispatchEvent(event);
			// this.emitEvent("timeupdate", this[currentTimeSymbol]);
			this[currentTimeSymbol] += 0.25;

			if (controlsView) {
				controlsView.currentTime = this[currentTimeSymbol];
			}

			if (this[currentTimeSymbol] >= this.duration) {
				this.pause();
			}
		}, 250);

		const controlsView = this.shadowRoot.querySelector("controls-skin") as Controls;
		controlsView?.play();

		const event = new Event("playing");
		this.dispatchEvent(event);
		// this.emitEvent("playing");
	}

	public pause() {
		if (this.paused) {
			return;
		}

		const controlsView = this.shadowRoot.querySelector("controls-skin") as Controls;
		controlsView.pause();

		window.clearInterval(this.playheadInterval);
		this.playheadInterval = undefined;

		const event = new Event("pause");
		this.dispatchEvent(event);
	}
}

window.customElements.define("fake-video", FakeHTMLVideoElement);
