import type { CueNode } from "@hsubs/server";
import TreeOrchestrator from "./TreeOrchestrator.js";

export class Presenter extends HTMLElement {
	private container = Object.assign(document.createElement("div"), {
		id: "caption-window",
		className: "hidden",
	});
	private renderArea = new TreeOrchestrator();

	public constructor() {
		super();

		const shadowRoot = this.attachShadow({ mode: "open" });
		const style = document.createElement("style");

		style.id = "host-styles";
		style.textContent = `
:host {
	left: 0; right: 0; bottom: 0; top: 0; position: absolute;
	display: flex;
	align-items: end;
	justify-content: center;
}

div#caption-window.hidden {
	display: none;
}

div#caption-window.active {
	margin-bottom: 10px;
	width: 300px;
	overflow-y: hidden;
	background-color: rgba(0,0,0,0.4);
}

div#scroll-area {
	scroll-behavior: smooth;
	height: 3em;
}

div#scroll-area p {
	margin: 0;
	box-sizing: border-box;
}

#scroll-area > p > span {
	color: #FFF;
	background-color: rgba(0,0,0,0.7);
	padding: 0px 15px;
	line-height: 1.5em;
	word-wrap: break-word;
	/**
	 * Change this to display:block for pop-on captions
	 * and whole background
	 */
	display: inline-block;
}
`;

		this.container.appendChild(this.renderArea.root);

		shadowRoot.appendChild(style);
		shadowRoot.appendChild(this.container);
	}

	public setCue(cueData?: CueNode[]): void {
		if (!cueData?.length) {
			this.container.classList.remove("active");
			this.container.classList.add("hidden");

			this.renderArea.wipeTree();
			this.renderArea.wipeEffects();
			return;
		}

		/**
		 * @TODO Select region to render if needed and
		 * select / create a new TreeOrchestrator
		 */

		this.renderArea.renderCuesToHTML(cueData);

		this.container.classList.add("active");
		this.container.classList.remove("hidden");
	}
}

customElements.define("captions-presenter", Presenter);
