import type { CueNode, Region, RenderingModifiers } from "@sub37/server";
import { IntervalBinaryTree, Entities } from "@sub37/server";
import { CSSVAR_TEXT_COLOR } from "./constants";

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
	 */
	roundRegionHeightLineFit?: boolean;
}

/**
 * This is the minimum frequency time of the
 * server. If a lower frequency is specified
 * in the server and some timed cues are distant
 * less than 250ms each other, some bad ui effects
 * might happen.
 */

const LINES_TRANSITION_TIME_MS = 250;
const ROOT_CLASS_NAME = "region";

const UNIT_REGEX = /\d+\.?\d+?[a-zA-Z%]+$/;

export default class TreeOrchestrator {
	private static DEFAULT_SETTINGS: OrchestratorSettings = {
		lines: 2,
		shiftDownFirstLine: false,
		roundRegionHeightLineFit: false,
	};

	private [rootElementSymbol]: HTMLDivElement;

	private settings: OrchestratorSettings;

	public constructor(
		parent: HTMLElement,
		trackRegionSettings?: Region,
		trackRenderingModifiers?: RenderingModifiers,
		settings?: Partial<OrchestratorSettings>,
	) {
		const root = Object.assign(document.createElement("div"), {
			className: ROOT_CLASS_NAME,
		});

		const regionScrollElement = document.createElement("div");
		regionScrollElement.dataset["role"] = "scroll-root";

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

		let lineHeightEM = 1.5;
		let regionHeight = trackRegionSettings?.height || this.settings.lines * lineHeightEM;

		if (regionHeight % lineHeightEM > 0 && this.settings.roundRegionHeightLineFit) {
			regionHeight = Math.ceil(regionHeight / lineHeightEM) * lineHeightEM;
		}

		const rootStyles: Partial<CSSStyleDeclaration> = {
			width: `${trackRegionSettings?.width ?? 100}%`,
			height: `${regionHeight}em`,
			left: originX,
			top: originY,
		};

		Object.assign(root.style, rootStyles);

		if (trackRenderingModifiers) {
			const modifiersElement = document.createElement("div");
			modifiersElement.dataset["role"] = "rendering-modifier";

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

		while (!root.classList.contains(ROOT_CLASS_NAME)) {
			root = root.parentElement;
		}

		return root;
	}

	public wipeTree(): void {
		for (let node: Node; (node = this[rootElementSymbol].firstChild); ) {
			this[rootElementSymbol].removeChild(node);
		}
	}

	public renderCuesToHTML(cueNodes: CueNode[]): void {
		const cues: CueNode[] = [];

		for (let i = 0; i < cueNodes.length; i++) {
			const cueNode = cueNodes[i];

			if (!cueNode.content.length) {
				continue;
			}

			const entitiesTree = new IntervalBinaryTree<Entities.GenericEntity>();

			for (let i = 0; i < cueNode.entities.length; i++) {
				entitiesTree.addNode(cueNode.entities[i]);
			}

			cues.push(...splitCueNodeByBreakpoints(cueNode, entitiesTree));
		}

		let latestCueId = "";
		let latestNode: HTMLElement = undefined;
		let latestHeight: number = 0;

		for (let i = 0; i < cues.length; i++) {
			const cue = cues[i];

			if (latestCueId !== cue.id) {
				latestNode = undefined;
				latestHeight = 0;
			}

			const firstDifferentEntityIndex = getCueNodeEntitiesDifferenceIndex(cue, cues[i - 1]);
			const [cueRootDomNode, textNode] = getCueNodeFragmentSubtree(cue, firstDifferentEntityIndex);

			let line = latestNode || createLine();
			commitFragmentOnLine(line, cueRootDomNode, firstDifferentEntityIndex);

			if (!line.parentNode) {
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
				const subTreeClone = wrapIntoEntitiesDocumentFragment(textNode, cue.entities);

				line = createLine();
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
		 * is it translated to the bottom of the X visible rows. A.k.a. 1.5em
		 * (at the current moment). Hence, we need to traslate vertically the
		 * whole block in steps of 1.5em (or "one line"), starting from 1.5 and
		 * then going negatively.
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
			 * - CHILDREN_AMOUNT + MAXIMUM_VISIBLE_ELEMENTS
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

			const upperBoundLimit = Number(
				this.settings.shiftDownFirstLine && childrenAmount === 1 && this.settings.lines > 1,
			);
			const linesToBeScrolled = Math.min(upperBoundLimit, -childrenAmount + this.settings.lines);

			this[rootElementSymbol].style.transform = `translateY(
				${1.5 * linesToBeScrolled}em
			)`;

			if (linesToBeScrolled <= 0) {
				const transformCSS = `transform ${LINES_TRANSITION_TIME_MS}ms cubic-bezier(0.25, 0.46, 0.2, 1.0) 0s`;
				this[rootElementSymbol].style.transition = transformCSS;
			}
		}
	}
}

function splitCueNodeByBreakpoints(
	cueNode: CueNode,
	entitiesTree: IntervalBinaryTree<Entities.GenericEntity>,
): CueNode[] {
	let idVariations = 0;
	let previousContentBreakIndex: number = 0;
	const cues: CueNode[] = [];

	for (let i = 0; i < cueNode.content.length; i++) {
		/**
		 * Reordering because IBT serves nodes from left to right,
		 * but left nodes are the smallest. In case of a global entity,
		 * it is inserted as the first node. Hence, it will will result
		 * as the last entity here. If so, we render wrong elements.
		 *
		 * Getting all the current entities and next entities so we can
		 * check if this is the last character before an entity begin
		 * (i.e. we have to break).
		 */

		const entitiesAtCoordinates = (entitiesTree.getCurrentNodes([i, i + 1]) ?? []).sort(
			reorderEntitiesComparisonFn,
		);

		if (shouldCueNodeBreak(cueNode.content, entitiesAtCoordinates, i)) {
			const content = cueNode.content.slice(previousContentBreakIndex, i + 1).trim();

			const cue = Object.create(cueNode, {
				content: {
					value: content,
				},
				entities: {
					value: entitiesAtCoordinates.filter((entity) => entity.offset <= i),
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
	}

	return cues;
}

function shouldCueNodeBreak(
	cueNodeContent: string,
	entitiesAtCoordinates: Entities.GenericEntity[],
	currentIndex: number,
): boolean {
	const char = cueNodeContent[currentIndex];

	return (
		isCharacterWhitespace(char) ||
		indexMatchesEntityBegin(currentIndex, entitiesAtCoordinates) ||
		indexMatchesEntityEnd(currentIndex, entitiesAtCoordinates) ||
		isCueContentEnd(cueNodeContent, currentIndex)
	);
}

function isCharacterWhitespace(char: string): boolean {
	return char === "\x20" || char === "\x09" || char === "\x0C" || char === "\x0A";
}

function indexMatchesEntityBegin(index: number, entities: Entities.GenericEntity[]): boolean {
	if (!entities.length) {
		return false;
	}

	for (const entity of entities) {
		if (index + 1 === entity.offset) {
			return true;
		}
	}

	return false;
}

function indexMatchesEntityEnd(index: number, entities: Entities.GenericEntity[]): boolean {
	if (!entities.length) {
		return false;
	}

	const lastEntity = entities[entities.length - 1];
	return lastEntity.offset + lastEntity.length === index;
}

function isCueContentEnd(cueNodeContent: string, index: number): boolean {
	return cueNodeContent.length - 1 === index;
}

function commitFragmentOnLine(lineRootNode: Node, cueSubTreeRoot: Node, diffDepth: number): void {
	getNodeAtDepth(diffDepth, lineRootNode.lastChild).appendChild(cueSubTreeRoot);
}

function createLine() {
	const node = document.createElement("p");
	node.appendChild(document.createElement("span"));

	return node;
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
	entities: Entities.GenericEntity[],
): Node {
	const fragment = new DocumentFragment();
	let latestNode: Node = rootNode;

	/**
	 * Rebuilding the Document from the last entity
	 * in order to encapsule one into another, and
	 * wrap the final root node inside them all.
	 */

	for (let i = entities.length - 1; i >= 0; i--) {
		const entity = entities[i];

		const node = getNodeFromEntity(entity);

		if (!node) {
			continue;
		}

		node.appendChild(latestNode);
		latestNode = node;
	}

	fragment.appendChild(latestNode);
	return fragment;
}

function getNodeFromEntity(entity: Entities.GenericEntity): Node | undefined {
	if (!(entity instanceof Entities.Tag)) {
		return undefined;
	}

	const node = getHTMLElementByEntity(entity);

	if (!entity.styles) {
		return node;
	}

	for (const [key, value] of Object.entries(entity.styles) as [string, string][]) {
		switch (key) {
			case "color": {
				/** Otherwise user cannot override the default style and track style */
				node.style.cssText += `${key}:var(${CSSVAR_TEXT_COLOR}, ${value});`;
				break;
			}

			default: {
				node.style.cssText += `${key}:${value};`;
			}
		}
	}

	return node;
}

function LangVoiceTagEntityProcessor(entity: Entities.Tag) {
	const node = document.createElement("span");

	for (let [key, value] of entity.attributes) {
		node.setAttribute(key, value ? value : "");
	}

	return node;
}

function ClassTagEntityProcessor() {
	return document.createElement("span");
}

const TAG_TYPE_ENTITY_DOM_MAP = {
	[Entities.TagType.BOLD]: (_entity: Entities.Tag) => document.createElement("b"),
	[Entities.TagType.ITALIC]: (_entity: Entities.Tag) => document.createElement("i"),
	[Entities.TagType.UNDERLINE]: (_entity: Entities.Tag) => document.createElement("u"),
	[Entities.TagType.RT]: (_entity: Entities.Tag) => document.createElement("rt"),
	[Entities.TagType.RUBY]: (_entity: Entities.Tag) => document.createElement("ruby"),
	[Entities.TagType.LANG]: LangVoiceTagEntityProcessor,
	[Entities.TagType.VOICE]: LangVoiceTagEntityProcessor,
	[Entities.TagType.CLASS]: ClassTagEntityProcessor,
	[Entities.TagType.SPAN]: (_entity: Entities.Tag) => document.createElement("span"),
} as const;

function getHTMLElementByEntity(entity: Entities.Tag): HTMLElement {
	const elementProcessor =
		TAG_TYPE_ENTITY_DOM_MAP[entity.tagType] || TAG_TYPE_ENTITY_DOM_MAP[Entities.TagType.SPAN];

	const element: HTMLElement = elementProcessor(entity);

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

	const longestCueEntitiesLength = Math.max(
		currentCue.entities.length,
		previousCue.entities.length,
	);

	const currentEntities = currentCue.entities;
	const previousEntities = previousCue.entities;

	for (let i = entityDifferenceIndex; i < longestCueEntitiesLength; i++, entityDifferenceIndex++) {
		if (!currentEntities[i] || !previousEntities[i]) {
			break;
		}

		const currentCueEntity = currentEntities[i];
		const previousCueEntity = previousEntities[i];

		if (
			currentCueEntity.length !== previousCueEntity.length ||
			currentCueEntity.offset !== previousCueEntity.offset
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
): [root: Node, textNode: Text] {
	const textNode = document.createTextNode(currentCue.content);

	return [
		wrapIntoEntitiesDocumentFragment(textNode, currentCue.entities.slice(entityDifferenceIndex)),
		textNode,
	];
}

function reorderEntitiesComparisonFn(e1: Entities.GenericEntity, e2: Entities.GenericEntity) {
	if (e1.offset < e2.offset) {
		/** e1 starts before e2 */
		return -1;
	}

	/**
	 * The condition `e1.offset > e2.offset` is not possible.
	 * Otherwise there would be an issue with parser. Tags open
	 * and close like onions. Hence, here we have `e1.offset == e2.offset`
	 */

	if (e1.length < e2.length) {
		/** e1 ends before e2, so it must be set last */
		return 1;
	}

	if (e1.length > e2.length) {
		/** e2 ends before e1, so it must be set first */
		return -1;
	}

	return 0;
}
