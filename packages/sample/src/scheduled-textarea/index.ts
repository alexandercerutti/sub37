import { TrackScheduler } from "../TrackScheduler";

export class ScheduledTextArea extends HTMLElement {
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
			scheduler.schedule((target as HTMLInputElement).value);
		});

		const scheduler = new TrackScheduler((text) => {
			/** Keep em sync, especially on first commit */
			textArea.value = text;
			const event = new CustomEvent("commit", { detail: text });
			this.dispatchEvent(event);
		});

		this.shadowRoot.appendChild(textArea);
	}
}

window.customElements.define("scheduled-textarea", ScheduledTextArea);
