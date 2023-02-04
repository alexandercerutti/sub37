import type { CueNode } from "@sub37/server";
import {
	CSSVAR_BOTTOM_SPACING,
	CSSVAR_REGION_BG_COLOR,
	CSSVAR_TEXT_BG_COLOR,
	CSSVAR_TEXT_COLOR,
} from "./constants.js";
import TreeOrchestrator from "./TreeOrchestrator.js";

export class Renderer extends HTMLElement {
	private container = Object.assign(document.createElement("main"), {
		id: "caption-window",
		className: "hidden",
	});

	/**
	 * Active regions are needed to have a state in case
	 * of animations. For example, in case of Youtube simulation
	 * translateY might go to 0ems, but we were at 1.5em.
	 *
	 * Creating the element again will reset the translation to
	 * 0 and will cause no animation.
	 */

	private activeRegions: { [region: string]: TreeOrchestrator } = {};

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
	/**
	 * Positive calculations because people might want
	 * to pull up the rendering area and not push it down
	 */
	height: calc(100% + var(${CSSVAR_BOTTOM_SPACING}, 0px));
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
	overflow-y: hidden;
	min-height: 1.5em;
	color: var(${CSSVAR_TEXT_COLOR}, #FFF);
}

div.region > div {
	background-color: var(${CSSVAR_REGION_BG_COLOR}, rgba(0,0,0,0.4));
	scroll-behavior: smooth;
}

div.region > div > p {
	margin: 0;
	box-sizing: border-box;
}

div.region > div > p > span {
	color: var(${CSSVAR_TEXT_COLOR}, #FFF);
	background-color: var(${CSSVAR_TEXT_BG_COLOR}, rgba(0,0,0,0.7));
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
			this.activeRegions = {};

			return;
		}

		/**
		 * Classes must be toggled before rendering,
		 * otherwise height won't be calculated.
		 */

		this.container.classList.add("active");
		this.container.classList.remove("hidden");

		const cueGroupsByRegion: { [key: string]: CueNode[] } = {};
		const nextActiveRegions: Renderer["activeRegions"] = {};

		for (const cue of cueData) {
			const region = cue.region?.id || "default";

			if (!cueGroupsByRegion[region]) {
				cueGroupsByRegion[region] = [];
			}

			cueGroupsByRegion[region].push(cue);
		}

		for (const [regionId, cues] of Object.entries(cueGroupsByRegion)) {
			let tree: TreeOrchestrator;

			if (this.activeRegions[regionId]) {
				tree = this.activeRegions[regionId];
			} else {
				tree = new TreeOrchestrator(cues[0].region, this.container);
			}

			/**
			 * Appending is required to happen before wiping
			 * so that re-used tree containers will render
			 * correctly and won't show previous elements.
			 */

			this.appendTree(tree);
			tree.renderCuesToHTML(cues);

			nextActiveRegions[regionId] = tree;
		}

		this.activeRegions = nextActiveRegions;
	}

	private wipeContainer(): void {
		for (const tree of Object.values(this.activeRegions)) {
			tree.wipeTree();
			tree.remove();
		}
	}

	private appendTree(tree: TreeOrchestrator): void {
		this.container.appendChild(tree.root);
	}
}

customElements.define("captions-renderer", Renderer);
