export interface ControlDelegates {
	onPlaybackStatusChange?(status: "PLAY" | "PAUSE"): void;
	onSeek?(newTime: number): void;
}

const controllersSymbol = Symbol("controllers");

export class Controls extends HTMLElement {
	private [controllersSymbol]: ControlDelegates = {};

	public constructor() {
		super();

		this.onPlaybackStatusChange = this.onPlaybackStatusChange.bind(this);

		const shadowRoot = this.attachShadow({ mode: "open" });
		const style = document.createElement("style");

		style.id = "host-styles";
		style.textContent = `
:host {
	width: 100%;
	height: 100%;
	display: block;
}

:host #ranger {
	width: 100%;
	display: flex;
	justify-content: space-evenly;
	gap: 20px;
	margin-bottom: 10px;
	position: absolute;
	bottom: 0;
	box-sizing: border-box;
	padding: 0 15px;
}

:host #ranger input {
	flex-grow: 1;
}

:host #ranger img {
	width: 1.2em;
}

:host #ranger span {
	width: 50px;
}
`;

		shadowRoot.appendChild(style);

		const ranger = Object.assign(document.createElement("div"), {
			id: "ranger",
		});

		const timeRange = Object.assign(document.createElement("input"), {
			type: "range",
			min: 0,
			max: 7646,
			value: 0,
			step: 0.25,
			id: "time-range",
		});

		timeRange.addEventListener("input", () => {
			const time = parseFloat(timeRange.value);
			this[controllersSymbol]?.onSeek?.(time);
			timeLabel.textContent = String(time);
		});

		const timeLabel = Object.assign(document.createElement("span"), {
			id: "currentTime",
			textContent: "0",
			style: {
				width: "50px",
			},
		});

		const durationLabel = Object.assign(document.createElement("span"), {
			id: "durationTime",
			textContent: "7646",
		});

		const playbackButton = Object.assign(document.createElement("img"), {
			src: "./pause-icon.svg",
			id: "playback-btn",
			style: {
				cursor: "click",
			},
		});
		playbackButton.dataset["playback"] = "playing";
		playbackButton.addEventListener("click", this.onPlaybackStatusChange);

		ranger.append(playbackButton, timeLabel, timeRange, durationLabel);
		shadowRoot.appendChild(ranger);
	}

	public set duration(value: number) {
		const valueString = String(value);
		const [input, timeLabel] = this.shadowRoot.querySelectorAll(
			"input, #durationTime",
		) as unknown as [HTMLInputElement, HTMLSpanElement];

		timeLabel.textContent = valueString;
		input.max = valueString;
	}

	public set currentTime(value: number) {
		const valueString = String(value);
		const [timeLabel, input] = this.shadowRoot.querySelectorAll(
			"input, #currentTime",
		) as unknown as [HTMLSpanElement, HTMLInputElement];

		timeLabel.textContent = valueString;
		input.value = valueString;
	}

	public set controllers(value: ControlDelegates) {
		this[controllersSymbol] = value;
	}

	public play(
		playbackButton: HTMLImageElement = this.shadowRoot.getElementById(
			"playback-btn",
		) as HTMLImageElement,
	) {
		playbackButton.src = "./pause-icon.svg";
		playbackButton.dataset["playback"] = "playing";
	}

	public pause(
		playbackButton: HTMLImageElement = this.shadowRoot.getElementById(
			"playback-btn",
		) as HTMLImageElement,
	) {
		playbackButton.src = "./play-icon.svg";
		playbackButton.dataset["playback"] = "paused";
	}

	private onPlaybackStatusChange() {
		const playbackButton: HTMLImageElement = this.shadowRoot.getElementById(
			"playback-btn",
		) as HTMLImageElement;

		if (playbackButton.dataset["playback"] === "playing") {
			this.pause(playbackButton);
			this[controllersSymbol]?.onPlaybackStatusChange?.("PAUSE");
		} else {
			this.play(playbackButton);
			this[controllersSymbol]?.onPlaybackStatusChange?.("PLAY");
		}
	}
}

window.customElements.define("controls-skin", Controls);
