import type { CueNode, Region, RenderingModifiers } from "@sub37/server";
import { Entities } from "@sub37/server";
import { CSSVAR_TEXT_COLOR } from "./constants";
import type { Sub37Region } from "./RegionElement.js";
import "./RegionElement.js";

const rootElementSymbol = Symbol("to.root.element");

export interface OrchestratorSettings {
	/**
	 * The maximum amount of lines on which the cue should be rendered on.
	 * Gets overridden by track's region lines property (if available).
	 * Defaults to `2`.
	 */
	lines: number;

	/**
	 * Allows enabling a Youtube-like mode, for which the first line
	 * is shifted down when nothing else if available.
	 * Defaults to `false`.
	 */
	shiftDownFirstLine?: boolean;

	/**
	 * When a track region's height might cut a line, this
	 * allows renderer to paint the full line in its height
	 * instead of cut.
	 *
	 * Defaults to `false`.
	 * @deprecated Use `snapHeightToLineGrid` instead.
	 */
	roundRegionHeightLineFit?: boolean;

	/**
	 * After rendering, snaps the region height to the nearest whole
	 * multiple of the actual line height (measured in px from the DOM).
	 * Prevents partially-visible lines regardless of what unit the
	 * authored region height uses (`%`, `px`, `em`, etc.).
	 *
	 * Defaults to `true`.
	 */
	snapHeightToLineGrid?: boolean;
}

/**
 * This is the minimum frequency time of the
 * server. If a lower frequency is specified
 * in the server and some timed cues are distant
 * less than 250ms each other, some bad ui effects
 * might happen.
 */

const LINES_TRANSITION_TIME_MS = 250;
const ROOT_TAG_NAME = "sub37-region";
const DEFAULT_LINE_HEIGHT_EM = 1.5;

const UNIT_REGEX = /\d+(?:\.\d+)?[a-zA-Z%]+$/;

export default class TreeOrchestrator {
	private static DEFAULT_SETTINGS: OrchestratorSettings = {
		lines: 2,
		shiftDownFirstLine: false,
		roundRegionHeightLineFit: false,
		snapHeightToLineGrid: true,
	};

	private [rootElementSymbol]: HTMLDivElement;

	private settings: OrchestratorSettings;
	private shiftDownFirstLine: boolean = false;

	public constructor(
		parent: HTMLElement,
		trackRegionSettings?: Region,
		trackRenderingModifiers?: RenderingModifiers,
		settings?: Partial<OrchestratorSettings>,
	) {
		const root = document.createElement(ROOT_TAG_NAME) as Sub37Region;

		root.dataset["trackRegionId"] = trackRegionSettings?.id ?? "";

		const regionScrollElement = document.createElement("div");
		regionScrollElement.classList.add("scroll-root");

		this[rootElementSymbol] = root.appendChild(regionScrollElement);

		this.settings = {
			...TreeOrchestrator.DEFAULT_SETTINGS,
			...settings,
			lines:
				trackRegionSettings?.lines || settings?.lines || TreeOrchestrator.DEFAULT_SETTINGS.lines,
		};

		let [originX, originY] = trackRegionSettings?.getOrigin(
			parent.offsetWidth,
			parent.offsetHeight,
		) ?? ["0%", "70%"];

		if (typeof originX === "number" || !UNIT_REGEX.test(originX)) {
			originX = `${originX}%`;
		}

		if (typeof originY === "number" || !UNIT_REGEX.test(originY)) {
			originY = `${originY}%`;
		}

		/**
		 * An authored height is an height expressed by
		 * the document for the region. When not available, it fallbacks
		 * to height derived by lines.
		 */
		const authoredHeight =
			typeof trackRegionSettings?.height === "number"
				? `${trackRegionSettings.height}%`
				: trackRegionSettings?.height;
		let regionHeight = authoredHeight ?? `${this.settings.lines * DEFAULT_LINE_HEIGHT_EM}em`;

		if (!authoredHeight && this.settings.roundRegionHeightLineFit) {
			const em = parseFloat(regionHeight);
			const rounded = Math.ceil(em / DEFAULT_LINE_HEIGHT_EM) * DEFAULT_LINE_HEIGHT_EM;
			regionHeight = `${rounded}em`;
		}

		const shiftDownFirstLine = !authoredHeight && (this.settings.shiftDownFirstLine ?? false);

		this.shiftDownFirstLine = shiftDownFirstLine;

		const rootStyles: Partial<CSSStyleDeclaration> = {
			width:
				typeof trackRegionSettings?.width === "number"
					? `${trackRegionSettings.width}%`
					: (trackRegionSettings?.width ?? "100%"),
			height: regionHeight,
			left: originX,
			top: originY,
		};

		Object.assign(root.style, rootStyles);
		root.applyEntities(trackRegionSettings?.entities ?? []);

		if (trackRenderingModifiers) {
			const modifiersElement = document.createElement("div");
			modifiersElement.classList.add("rendering-modifier");

			const styles: Partial<CSSStyleDeclaration> = {
				position: "relative",
				width: `${trackRenderingModifiers.width}%`,
				left: `${trackRenderingModifiers.leftOffset}%`,
				textAlign: trackRenderingModifiers.textAlignment,
			};

			Object.assign(modifiersElement.style, styles);
			this[rootElementSymbol] = this[rootElementSymbol].appendChild(modifiersElement);
		}
	}

	public remove(): void {
		this.root.remove();
	}

	public get root(): HTMLElement {
		let root: HTMLElement = this[rootElementSymbol];

		while (root.tagName.toLowerCase() !== ROOT_TAG_NAME) {
			root = root.parentElement!;
		}

		return root;
	}

	public wipeTree(): void {
		for (let node: Node | null; (node = this[rootElementSymbol].firstChild); ) {
			this[rootElementSymbol].removeChild(node);
		}
	}

	public renderCuesToHTML(cueNodes: CueNode[]): void {
		const cues: CueNode[] = [];

		for (let i = 0; i < cueNodes.length; i++) {
			const cueNode = cueNodes[i]!;

			if (!cueNode.content.length) {
				continue;
			}

			cues.push(...splitCueNodeByBreakpoints(cueNode));
		}

		let latestCueId = "";
		let latestNode: HTMLElement | undefined = undefined;
		let latestHeight: number = 0;

		for (let i = 0; i < cues.length; i++) {
			const cue = cues[i]!;

			if (latestCueId !== cue.id) {
				latestNode = undefined;
				latestHeight = 0;
			}

			/**
			 * Checking first the difference between the
			 * entities of two cues. Such index will be used
			 * as insertion point of the structure inside
			 * the line.
			 */

			const firstDifferentEntityIndex = getCueNodeEntitiesDifferenceIndex(cue, cues[i - 1]);
			const [cueRootDomNode, textNode, cueKeyframesCSS] = getCueNodeFragmentSubtree(
				cue,
				firstDifferentEntityIndex,
			);

			let line: HTMLElement =
				latestNode || createLine(cue.entities.filter(Entities.isLineStyleEntity));
			commitFragmentOnLine(line, cueRootDomNode, firstDifferentEntityIndex);

			if (!line.parentNode) {
				if (cueKeyframesCSS) {
					const styleEl = document.createElement("style");
					styleEl.textContent = cueKeyframesCSS;
					this[rootElementSymbol].appendChild(styleEl);
				}

				this[rootElementSymbol].appendChild(line);
			}

			/**
			 * Space character between words might be responsible
			 * for going on a new line.
			 */

			if (i > 0) {
				textNode.textContent = `\x20${textNode.textContent}`;
			}

			const nextHeight = getLineHeight(line);
			const shouldCreateNewLine = latestHeight > 0 && nextHeight >= latestHeight * 2;

			if (shouldCreateNewLine) {
				let textParentNode = textNode.parentNode as HTMLElement;
				const [subTreeClone] = wrapIntoEntitiesDocumentFragment(textNode, cue.entities);

				line = createLine(cue.entities.filter(Entities.isLineStyleEntity));
				commitFragmentOnLine(line, subTreeClone, cue.entities.length);

				while (!textParentNode.childNodes.length) {
					/** Cleaning up empty parents */
					const node = textParentNode;
					textParentNode = textParentNode.parentNode as HTMLElement;
					node.remove();
				}

				if (textNode.textContent[0] === "\x20") {
					textNode.textContent = textNode.textContent.slice(1);
				}

				this[rootElementSymbol].appendChild(line);
			}

			if (nextHeight >= latestHeight * 2) {
				/**
				 * Height might change of a few PXs due to tags like <ruby> + <rt>.
				 * We only want to track if a line height changes to take a whole new
				 * line space.
				 */
				latestHeight = nextHeight;
			}

			latestCueId = cue.id;
			latestNode = line;
		}

		/**
		 * To achieve a Youtube-like subtitle effect, when a cue is alone
		 * is it translated to the bottom of the X visible rows. Hence, we
		 * need to traslate vertically the whole block in steps of one line's
		 * height starting from the original height and then going negatively.
		 *
		 * If height is 1.5, for example:
		 *
		 * 1.5 -> 0 -> -1.5 -> -3 -> -4.5
		 */

		if (this[rootElementSymbol].children.length) {
			const {
				children: { length: childrenAmount },
			} = this[rootElementSymbol];

			/**
			 * We need to obtain the number of rows we should scroll of.
			 *
			 * (-CHILDREN_AMOUNT + VISIBLE_LINES)
			 *
			 * (-1) + 2 =  1  =>  1.5 *  1 =  1.5
			 * (-2) + 2 =  0  =>  1.5 *  0 =  0.0
			 * (-3) + 2 = -1  =>  1.5 * -1 = -1.5
			 * (-4) + 2 = -2  =>  1.5 * -2 = -3.0
			 *
			 * We have to limit the upper bound limit to prevent issues with
			 * overflow and scrolling. 1 if we want to simulate Youtube,
			 * 0 otherwise.
			 */

			const visibleLines = this.settings.lines;

			const upperBoundLimit = Number(
				this.shiftDownFirstLine && childrenAmount === 1 && visibleLines > 1,
			);

			const linesToBeScrolled = Math.min(upperBoundLimit, -childrenAmount + visibleLines);

			const lineHeightPx =
				(this[rootElementSymbol].firstElementChild as HTMLElement | null)?.offsetHeight ?? 0;

			if (this.settings.snapHeightToLineGrid && lineHeightPx > 0) {
				const wholeLines = Math.round(this.root.offsetHeight / lineHeightPx);

				if (wholeLines > 0) {
					this.root.style.height = `${wholeLines * lineHeightPx}px`;
				}
			}

			const translateStep =
				lineHeightPx > 0 ? `${lineHeightPx * linesToBeScrolled}px` : `${1.5 * linesToBeScrolled}em`;

			this[rootElementSymbol].style.transform = `translateY(${translateStep})`;

			if (linesToBeScrolled <= 0) {
				const transformCSS = `transform ${LINES_TRANSITION_TIME_MS}ms cubic-bezier(0.25, 0.46, 0.2, 1.0) 0s`;
				this[rootElementSymbol].style.transition = transformCSS;
			}
		}
	}
}

function splitCueNodeByBreakpoints(cueNode: CueNode): CueNode[] {
	let idVariations = 0;
	let previousContentBreakIndex: number = 0;
	const cues: CueNode[] = [];

	for (let i = 0; i < cueNode.content.length; i++) {
		if (!shouldCueNodeBreak(cueNode.content, i)) {
			continue;
		}

		const content = cueNode.content.substring(previousContentBreakIndex, i + 1).trim();

		const cue = Object.create(cueNode, {
			content: {
				value: content,
			},
		});

		if (idVariations > 0) {
			cue.id = `${cue.id}/${idVariations}`;
		}

		/**
		 * If we detect a new line, we want to force the creation
		 * of a new line on the next content. So we increase the variation
		 * so that rendering will break line on a different cue id.
		 */

		if (cueNode.content[i] === "\x0A") {
			idVariations++;
		}

		cues.push(cue);

		previousContentBreakIndex = i + 1;
	}

	return cues;
}

function shouldCueNodeBreak(cueNodeContent: string, currentIndex: number): boolean {
	const char = cueNodeContent[currentIndex]!;

	return isCharacterWhitespace(char) || isCueContentEnd(cueNodeContent, currentIndex);
}

function isCharacterWhitespace(char: string): boolean {
	return char === "\x20" || char === "\x09" || char === "\x0C" || char === "\x0A";
}

function isCueContentEnd(cueNodeContent: string, index: number): boolean {
	return cueNodeContent.length - 1 === index;
}

function commitFragmentOnLine(lineRootNode: Node, cueSubTreeRoot: Node, diffDepth: number): void {
	getNodeAtDepth(diffDepth, lineRootNode.lastChild!).appendChild(cueSubTreeRoot);
}

function createLine(lineEntities: Entities.LineStyleEntity[]): HTMLElement {
	/**
	 * LineNode is needed to have an precise place
	 * where to put block styles.
	 */
	const lineNode = document.createElement("p");
	lineNode.classList.add("line-block");

	const lineStylesEntries = Object.assign({}, ...lineEntities.map((e) => e.styles));

	for (const [key, value] of Object.entries(lineStylesEntries)) {
		lineNode.style.cssText += `${key}:${value};`;

		/**
		 * FCC 47 CFR § 79.103 mandates user settings to be able to override authored ones,
		 * so we need to make sure that some important styles can be overridden by users.
		 *
		 * Here below, we suppress our internal styles when authored styles are present.
		 */
		if (key === "background-color") {
			lineNode.style.setProperty("--s37-int-bgcolor", "transparent");
		}

		if (key.startsWith("padding")) {
			lineNode.style.setProperty("--s37-int-padding", "0px");
		}
	}

	lineNode.appendChild(document.createElement("span"));
	return lineNode;
}

function getLineHeight(line: HTMLElement) {
	return Math.floor(line.offsetHeight);
}

function getNodeAtDepth(depth: number, node: Node): Node {
	let latestNodePointer: Node = node;

	while (depth > 0 && latestNodePointer.lastChild) {
		if (latestNodePointer.lastChild.nodeType !== Node.ELEMENT_NODE) {
			break;
		}

		latestNodePointer = latestNodePointer.lastChild;
		depth--;
	}

	return latestNodePointer;
}

function wrapIntoEntitiesDocumentFragment(
	rootNode: Node,
	entities: Entities.AllEntities[],
): [element: Node, keyframeString: string] {
	const fragment = new DocumentFragment();
	let latestNode: Node = rootNode;

	const styleEntities = entities
		.filter(Entities.isLocalStyleEntity)
		.flatMap((entity) => Object.entries(entity.styles));
	const tagEntities = entities.filter(Entities.isTagEntity);
	const animationEntities = entities.filter(Entities.isAnimationEntity);

	if (styleEntities.length || animationEntities.length) {
		const styleNode = document.createElement("span");

		for (const [key, value] of styleEntities) {
			switch (key) {
				case "color": {
					/** Otherwise user cannot override the default style and track style */
					styleNode.style.cssText += `${key}:var(${CSSVAR_TEXT_COLOR}, ${value});`;
					break;
				}

				default: {
					styleNode.style.cssText += `${key}:${value};`;
				}
			}
		}

		if (animationEntities.length) {
			styleNode.style.animation = animationEntities.map(buildAnimationShorthand).join(", ");
		}

		styleNode.appendChild(latestNode);
		latestNode = styleNode;
	}

	/**
	 * Rebuilding the Document from the last entity
	 * in order to encapsule one into another, and
	 * wrap the final root node inside them all.
	 */

	for (let i = tagEntities.length - 1; i >= 0; i--) {
		const entity = tagEntities[i]!;

		const node = getHTMLElementByEntity(entity);

		if (!node) {
			continue;
		}

		node.appendChild(latestNode);
		latestNode = node;
	}

	fragment.appendChild(latestNode);
	return [fragment, buildKeyframesCSS(animationEntities)];
}

const TAG_TYPE_ENTITY_DOM_MAP = {
	[Entities.TagType.BOLD]: (_entity: Entities.TagEntity) => document.createElement("b"),
	[Entities.TagType.ITALIC]: (_entity: Entities.TagEntity) => document.createElement("i"),
	[Entities.TagType.UNDERLINE]: (_entity: Entities.TagEntity) => document.createElement("u"),
	[Entities.TagType.RT]: (_entity: Entities.TagEntity) => document.createElement("rt"),
	[Entities.TagType.RUBY]: (_entity: Entities.TagEntity) => document.createElement("ruby"),
	[Entities.TagType.SPAN]: (_entity: Entities.TagEntity) => document.createElement("span"),
} as const;

function getHTMLElementByEntity(entity: Entities.TagEntity): HTMLElement | undefined {
	const elementProcessor =
		TAG_TYPE_ENTITY_DOM_MAP[entity.tagType] || TAG_TYPE_ENTITY_DOM_MAP[Entities.TagType.SPAN];

	const element: HTMLElement = elementProcessor(entity);

	if (!element) {
		return undefined;
	}

	for (let [key, value] of entity.attributes) {
		element.setAttribute(key, value ? value : "");
	}

	for (const className of entity.classes) {
		element.classList.add(className);
	}

	return element;
}

/**
 * Compares two cues and retrieves the index (which
 * is the DOM line depth level) at which the first
 * different entity should be inserted.
 *
 * Entities should always be in the same and same
 * position when they are in similar cues in order
 * for rendering to work properly.
 *
 * @param currentCue
 * @param previousCue
 * @returns
 */
function getCueNodeEntitiesDifferenceIndex(currentCue: CueNode, previousCue?: CueNode): number {
	if (!currentCue.entities.length || !previousCue?.entities.length) {
		return 0;
	}

	/**
	 * We change the cue ID when we find
	 * a new line
	 */
	if (currentCue.id !== previousCue.id) {
		return 0;
	}

	let entityDifferenceIndex = 0;

	const currentEntities = currentCue.entities.filter(isTagEntityOrLocalStyleEntity);
	const previousEntities = previousCue.entities.filter(isTagEntityOrLocalStyleEntity);

	const longestCueEntitiesLength = Math.max(currentEntities.length, previousEntities.length);

	for (let i = entityDifferenceIndex; i < longestCueEntitiesLength; i++, entityDifferenceIndex++) {
		if (!currentEntities[i] || !previousEntities[i]) {
			break;
		}

		const currentCueEntity = currentEntities[i]!;
		const previousCueEntity = previousEntities[i]!;

		if (currentCueEntity !== previousCueEntity) {
			break;
		}

		if (
			Entities.isTagEntity(currentCueEntity) &&
			// this is always true for the condition above
			// but typescript doesn't know it and keeps throwing error
			Entities.isTagEntity(previousCueEntity) &&
			currentCueEntity.tagType !== previousCueEntity.tagType
		) {
			break;
		}
	}

	return entityDifferenceIndex;
}

/**
 * Given a cue, retrieves the DocumentFragment
 * with entities of its text content.
 *
 * @param currentCue
 * @param entityDifferenceIndex
 * @returns A tuple containing the whole fragment
 * 					and the wrapped textNode
 */
function getCueNodeFragmentSubtree(
	currentCue: CueNode,
	entityDifferenceIndex: number,
): [root: Node, textNode: Text, keyframesCSS: string] {
	const textNode = document.createTextNode(currentCue.content);

	const filteredEntities = currentCue.entities
		.filter(isTagEntityOrLocalStyleOrAnimationEntity)
		.slice(entityDifferenceIndex);

	const [fragment, keyframesCSS] = wrapIntoEntitiesDocumentFragment(textNode, filteredEntities);
	return [fragment, textNode, keyframesCSS];
}

function isTagEntityOrLocalStyleOrAnimationEntity(
	entity: Entities.AllEntities,
): entity is Entities.TagEntity | Entities.LocalStyleEntity | Entities.AnimationEntity {
	return (
		Entities.isTagEntity(entity) ||
		Entities.isLocalStyleEntity(entity) ||
		Entities.isAnimationEntity(entity)
	);
}
