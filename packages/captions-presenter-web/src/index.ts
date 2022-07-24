import type { CueNode } from "@hsubs/server";
import TreeOrchestrator from "./TreeOrchestrator.js";

export class Renderer extends HTMLElement {
	private mainRegion = Object.assign(document.createElement("div"), {
		id: "scroll-window",
	});
	private renderArea = new TreeOrchestrator();

	/**
	 * This strategy allows people to apply a roll-up captions
	 * animation (smooth) or a pop-on captions disappearance
	 * (discrete)
	 */

	private exitTransitionMode: "discrete" | "smooth" = "discrete";

	private currentCues: Set<CueNode> = new Set<CueNode>();

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

div#scroll-window {
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

#scroll-area p span {
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

		this.mainRegion.appendChild(this.renderArea.root);

		shadowRoot.appendChild(style);
		shadowRoot.appendChild(this.mainRegion);

		const exitTransitionAttribute = this.getAttribute("exit-transition") ?? "discrete";

		if (exitTransitionAttribute === "discrete" || exitTransitionAttribute === "smooth") {
			this.exitTransitionMode = exitTransitionAttribute;
		}
	}

	public setCue(cueData?: CueNode[]) {
		if (!cueData?.length) {
			this.renderArea.wipeTree();
			this.renderArea.wipeEffects();
			this.currentCues = new Set<CueNode>();
			return;
		}

		this.renderArea.renderCuesToHTML(cueData);
	}
}

function getPresentableCueContent(cueNode: CueNode): string {
	/** @TODO add entities */
	return cueNode.content;
}

customElements.define("captions-presenter", Renderer);
