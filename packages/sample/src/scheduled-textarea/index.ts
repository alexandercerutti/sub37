import { TrackScheduler } from "../TrackScheduler";

export class ScheduledTextArea extends HTMLElement {
	private scheduler: TrackScheduler;

	constructor() {
		super();
		this.attachShadow({ mode: "open" });

		const style = document.createElement("style");
		style.textContent = `
textarea {
	padding: 10px;
	width: 100%;
	outline-color: rgb(197, 66, 6);
	height: 500px;
	font-size: inherit;
	resize: none;
	font-weight: 300;
	box-sizing: border-box;
}
`;

		this.shadowRoot.appendChild(style);

		const textArea = Object.assign(document.createElement("textarea"), {
			placeholder: this.getAttribute("placeholder"),
		});

		textArea.addEventListener("input", ({ target }) => {
			this.scheduler.schedule((target as HTMLInputElement).value);
		});

		/**
		 * We want to wait for listeners to setup outside before creating
		 * the scheduler.
		 */

		window.setTimeout(() => {
			this.scheduler = new TrackScheduler((text) => {
				/** Keep em sync, especially on first commit */
				textArea.value = text;
				const event = new CustomEvent("commit", { detail: text });
				this.dispatchEvent(event);
			});
		}, 0);

		this.shadowRoot.appendChild(textArea);
	}

	public set value(value: string) {
		(this.shadowRoot.querySelector("textarea") as HTMLTextAreaElement).value = value;
		this.scheduler.schedule(value);
	}

	public get value(): string {
		return (this.shadowRoot.querySelector("textarea") as HTMLTextAreaElement).value;
	}
}

window.customElements.define("scheduled-textarea", ScheduledTextArea);
