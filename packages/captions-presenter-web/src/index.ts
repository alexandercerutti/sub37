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
	left: 0;
	right: 0;
	bottom: 0;
	top: 0;
	position: absolute;
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

div.region {
	scroll-behavior: smooth;
	height: max-content; /** Chromium 46 **/
	min-height: 3em;
}

div.region p {
	margin: 0;
	box-sizing: border-box;
}

div.region > p > span {
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

		this.renderArea.appendTo(this.container);

		shadowRoot.appendChild(style);
		shadowRoot.appendChild(this.container);
	}

	public setCue(cueData?: CueNode[]): void {
		this.wipeContainer();

		if (!cueData?.length) {
			this.container.classList.remove("active");
			this.container.classList.add("hidden");
			return;
		}

		/**
		 * Classes must be toggled before rendering,
		 * otherwise height won't be calculated.
		 */

		this.container.classList.add("active");
		this.container.classList.remove("hidden");

		/**
		 * @TODO Select region to render if needed and
		 * select / create a new TreeOrchestrator
		 */

		this.renderArea.appendTo(this.container);
		this.renderArea.renderCuesToHTML(cueData);
	}

	private wipeContainer() {
		for (let i = 0; i < this.container.children.length; i++) {
			this.container.children[i].remove();
		}
	}
}

customElements.define("captions-presenter", Presenter);
