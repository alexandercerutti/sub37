import type { CueNode } from "@hsubs/server";
import TreeOrchestrator from "./TreeOrchestrator.js";

export class Presenter extends HTMLElement {
	private container = Object.assign(document.createElement("main"), {
		id: "caption-window",
		className: "hidden",
	});

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

main#caption-window {
	position: relative;
	width: 100%;
	height: 100%;
	overflow: hidden;
}

main#caption-window.hidden {
	display: none;
}

main#caption-window.active {
	display: block;
}

div.region {
	position: absolute;
	bottom: 3em;

	background-color: rgba(0,0,0,0.4);
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

		const cueGroupsByRegion: { [key: string]: CueNode[] } = {};

		for (const cue of cueData) {
			const region = cue.region?.id || "default";

			if (!cueGroupsByRegion[region]) {
				cueGroupsByRegion[region] = [];
			}

			cueGroupsByRegion[region].push(cue);
		}

		for (const cues of Object.values(cueGroupsByRegion)) {
			const tree = new TreeOrchestrator(cues[0].region, this.container);
			tree.renderCuesToHTML(cues);
		}
	}

	private wipeContainer() {
		let region: ChildNode;

		while ((region = this.container.firstChild)) {
			region.remove();
		}
	}
}

customElements.define("captions-presenter", Presenter);
