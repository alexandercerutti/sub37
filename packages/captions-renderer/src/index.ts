import { Events } from "@sub37/server";
import type { Server } from "@sub37/server";
import type { ParseError, CueNode, RenderingModifiers } from "@sub37/adapter-utils";
import {
	CSSVAR_BOTTOM_SPACING,
	CSSVAR_BOTTOM_TRANSITION,
	CSSVAR_REGION_AREA_BG_COLOR,
	CSSVAR_REGION_BG_COLOR,
	CSSVAR_TEXT_BG_COLOR,
	CSSVAR_SPAN_PADDING_X,
	CSSVAR_TEXT_COLOR,
} from "./constants.js";
import TreeOrchestrator from "./TreeOrchestrator.js";
import type { OrchestratorSettings } from "./TreeOrchestrator.js";

export * from "./constants.js";
export type { OrchestratorSettings } from "./TreeOrchestrator.js";

class Renderer extends HTMLElement {
	private container = Object.assign(document.createElement("main"), {
		id: "caption-window",
		className: "hidden",
	});

	/**
	 * Properties to be applied to all regions.
	 * Some properties might get overridden by regions
	 * or rendering modifiers.
	 */

	private regionsProperties: Partial<OrchestratorSettings> = {};

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
	/**
	 * This component is meant to be set inside a container
	 * along with video tag sibling
	 */

	width: 100%;
	height: 100%;
}

main#caption-window {
	position: relative;
	width: 100%;
	/**
	 * Positive calculations because people might want
	 * to pull up the rendering area and not push it down
	 */
	height: calc(100% + var(${CSSVAR_BOTTOM_SPACING}, 0px));
	transition: height var(${CSSVAR_BOTTOM_TRANSITION}, 0s linear);
	overflow: hidden;
}

main#caption-window.hidden {
	display: none;
}

main#caption-window.active {
	display: block;
}

sub37-region {
	position: absolute;
	overflow-y: hidden;
	min-height: 1.5em;
	color: var(${CSSVAR_TEXT_COLOR}, #FFF);
	background-color: var(${CSSVAR_REGION_AREA_BG_COLOR}, transparent);
}

sub37-region > div.scroll-root {
	background-color: var(${CSSVAR_REGION_BG_COLOR}, rgba(0,0,0,0.4));
	scroll-behavior: smooth;
}

sub37-region div > p {
	margin: 0;
	box-sizing: border-box;
}

sub37-region div > p.line-block {
	color: var(${CSSVAR_TEXT_COLOR}, #FFF);
	--s37__internal__bgcolor: rgba(0, 0, 0, 0.7);
}
	
sub37-region div > p.line-block > span {
		/**
		 * Giving priority to user customization, then to the internal color and
		 * then to the default.
		 * --sub37__internal__bgcolor is defined on the p.line-block as the fallback
		 * and will be replaced when the line is created when needed (so, if
		 * the line has a specific background-color). By doing this way, this
		 * variable cannot get overridden from outside.
		 */
		background-color: var(${CSSVAR_TEXT_BG_COLOR}, var(--s37__internal__bgcolor));
	
		/**
		 * Priority: user (${CSSVAR_SPAN_PADDING_X}) → document (--s37__internal__padding) → default.
		 * FCC 47 CFR § 79.103 requires user settings to always prevail over authored ones.
		 */
		padding: 0 var(${CSSVAR_SPAN_PADDING_X}, var(--s37__internal__padding, 15px));

		line-height: 1.5em;
		word-wrap: break-word;
		/**
		 * Change this to display:block for pop-on captions
		 * and whole background. Tho, this is not exposed.
		 * Should we?
		 */
		display: inline-block;
}
`;

		shadowRoot.appendChild(style);
		shadowRoot.appendChild(this.container);
	}

	/**
	 * Allows setting some properties that regions should use when rendered.
	 * Not every property might get used: tt stands to each own property to
	 * handle the priority over some defaults (e.g. track regions' properties
	 * might have an higher priority).
	 *
	 * @param props
	 */

	public setRegionProperties(props: Partial<OrchestratorSettings>): void {
		this.regionsProperties = props;
	}

	/**
	 * Sets the cues to be rendered. Pass and empty array or nothing to
	 * removed all the cues and regions.
	 *
	 * @param cueData
	 * @returns
	 */

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

		for (let i = 0; i < cueData.length; i++) {
			const cue = cueData[i]!;
			const prevCue = cueData[i - 1];

			const modifierId = getRegionModifierId(cue.renderingModifiers, prevCue?.renderingModifiers);

			const regionIdentifier = cue.region?.id || "default";
			const region = modifierId ? `${regionIdentifier}-${modifierId}` : regionIdentifier;

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
				tree = new TreeOrchestrator(cues[0]!.region, this.regionsProperties);
			}

			tree.paint(this.container, cues[0]!.region, cues[0]!.renderingModifiers);

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

	public connect(
		serverInstance: Server,
		onError: (error: ParseError) => void,
	): { disconnect: () => void } {
		const onCueStart = (cues: CueNode[]): void => {
			this.setCue(cues);
		};

		const onCueStop = (): void => {
			this.setCue();
		};

		const onCueError = (parsingError: ParseError): void => {
			onError(parsingError);
		};

		const onUserPause = (): void => {
			for (const regionId in this.activeRegions) {
				const region = this.activeRegions[regionId]!;

				region.setAnimationActivity(false);
			}
		};

		const onUserResume = (): void => {
			for (const regionId in this.activeRegions) {
				const region = this.activeRegions[regionId]!;

				region.setAnimationActivity(true);
			}
		};

		serverInstance.addEventListener(Events.CUE_START, onCueStart);
		serverInstance.addEventListener(Events.CUE_STOP, onCueStop);
		serverInstance.addEventListener(Events.CUE_ERROR, onCueError);
		serverInstance.addEventListener(Events.USER_PAUSE, onUserPause);
		serverInstance.addEventListener(Events.USER_RESUME, onUserResume);

		let active = true;

		return {
			disconnect: () => {
				if (!active) {
					return;
				}

				active = false;

				serverInstance.removeEventListener(Events.CUE_START, onCueStart);
				serverInstance.removeEventListener(Events.CUE_STOP, onCueStop);
				serverInstance.removeEventListener(Events.CUE_ERROR, onCueError);
				serverInstance.removeEventListener(Events.USER_PAUSE, onUserPause);
				serverInstance.removeEventListener(Events.USER_RESUME, onUserResume);

				/** @ts-ignore - breaking the reference if the user keeps the object */
				serverInstance = undefined;
			},
		};
	}
}

/**
 * A region is created by looking at the region object itself
 * and by looking at the RenderingModifier's id
 *
 * @param r1
 * @param r2
 * @param cueIndex
 * @returns
 */

function getRegionModifierId(
	r1: RenderingModifiers | undefined,
	r2: RenderingModifiers | undefined,
): number | undefined {
	if (!r1) {
		return r2?.id || undefined;
	}

	if (!r2) {
		return r1.id;
	}

	return r1.id;
}

customElements.define("captions-renderer", Renderer);
export type CaptionsRenderer = typeof Renderer;
