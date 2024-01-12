import type { CueNode, Region, RenderingModifiers } from "@sub37/server";
import { Entities } from "@sub37/server";
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

export default class TreeOrchestrator {
	private static DEFAULT_SETTINGS: OrchestratorSettings = {
		lines: 2,
		shiftDownFirstLine: false,
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

		this[rootElementSymbol] = root.appendChild(document.createElement("div"));

		this.settings = {
			...TreeOrchestrator.DEFAULT_SETTINGS,
			...settings,
			lines:
				trackRegionSettings?.lines || settings?.lines || TreeOrchestrator.DEFAULT_SETTINGS.lines,
		};

		const [originX, originY] = trackRegionSettings?.getOrigin(
			parent.offsetWidth,
			parent.offsetHeight,
		) ?? [0, 70];

		const rootStyles: Partial<CSSStyleDeclaration> = {
			width: `${trackRegionSettings?.width ?? 100}%`,
			height: `${this.settings.lines * 1.5}em`,
			left: `${originX}%`,
			top: `${originY}%`,
		};

		Object.assign(root.style, rootStyles);

		if (trackRenderingModifiers) {
			const modifiersElement = document.createElement("div");

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

			cues.push(...splitCueNodeByBreakpoints(cueNode));
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

			const [cueRootDomNode, firstDifferentEntityIndex, textNode] = getSubtreeFromCueNodes(
				cue,
				cues[i - 1],
			);

			let line = commitDOMTree(latestNode, cueRootDomNode, firstDifferentEntityIndex);

			if (!latestNode) {
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

			if (latestHeight > 0 && nextHeight >= latestHeight * 2) {
				let textParentNode = textNode.parentNode as HTMLElement;
				const subTreeClone = entitiesToDOM(textNode, ...cue.entities);

				line = commitDOMTree(undefined, subTreeClone, cue.entities.length);

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
	const char = cueNodeContent[currentIndex];

	return isCharacterWhitespace(char) || isCueContentEnd(cueNodeContent, currentIndex);
}

function isCharacterWhitespace(char: string): boolean {
	return char === "\x20" || char === "\x09" || char === "\x0C" || char === "\x0A";
}

function isCueContentEnd(cueNodeContent: string, index: number): boolean {
	return cueNodeContent.length - 1 === index;
}

function commitDOMTree(rootNode: Node, cueSubTreeRoot: Node, diffDepth: number): HTMLElement {
	const root = rootNode || createLine();
	addNode(getNodeAtDepth(diffDepth, root.lastChild), cueSubTreeRoot);
	return root as HTMLElement;
}

function createLine() {
	const node = document.createElement("p");
	node.appendChild(document.createElement("span"));

	return node;
}

function getLineHeight(line: HTMLElement) {
	return Math.floor(line.offsetHeight);
}

function getNodeAtDepth(index: number, node: Node) {
	let latestNodePointer: Node = node;

	while (index > 0 && latestNodePointer.lastChild) {
		if (latestNodePointer.lastChild.nodeType !== Node.ELEMENT_NODE) {
			break;
		}

		latestNodePointer = latestNodePointer.lastChild;
		index--;
	}

	return latestNodePointer;
}

function entitiesToDOM(rootNode: Node, ...entities: Entities.AllEntities[]): Node {
	const subRoot = new DocumentFragment();
	let latestNode: Node = rootNode;

	const styleEntities = entities
		.filter(Entities.isStyleEntity)
		.flatMap((entity) => Object.entries(entity.styles));
	const tagEntities = entities.filter(Entities.isTagEntity);

	if (styleEntities.length) {
		const styleNode = document.createElement("span");

		for (const [key, styleValue] of styleEntities) {
			let value: string = styleValue;

			if (key === "color") {
				/** Otherwise user cannot override the default style and track style */
				value = `var(${CSSVAR_TEXT_COLOR}, ${styleValue});`;
			}

			styleNode.style.cssText += `${key}:${value}`;
		}

		styleNode.appendChild(latestNode);
		latestNode = styleNode;
	}

	for (const entity of tagEntities) {
		const node = getHTMLElementByEntity(entity);

		if (!node) {
			continue;
		}

		node.appendChild(latestNode);
		latestNode = node;
	}

	subRoot.appendChild(latestNode);
	return subRoot;
}

function getHTMLElementByEntity(entity: Entities.TagEntity): HTMLElement | undefined {
	const element: HTMLElement | undefined = (() => {
		switch (entity.tagType) {
			case Entities.TagType.BOLD: {
				return document.createElement("b");
			}
			case Entities.TagType.ITALIC: {
				return document.createElement("i");
			}
			case Entities.TagType.UNDERLINE: {
				return document.createElement("u");
			}
			case Entities.TagType.RT: {
				return document.createElement("rt");
			}
			case Entities.TagType.RUBY: {
				return document.createElement("ruby");
			}
			case Entities.TagType.LANG:
			case Entities.TagType.VOICE: {
				const node = document.createElement("span");

				for (let [key, value] of entity.attributes) {
					node.setAttribute(key, value ? value : "");
				}

				return node;
			}
			default: {
				return undefined;
			}
		}
	})();

	if (!element) {
		return undefined;
	}

	for (const className of entity.classes) {
		element.classList.add(className);
	}

	return element;
}

function addNode(node: Node, content: Node): Node {
	node.appendChild(content);
	return node;
}

/**
 * Compares two cues to check where the first not-shared
 * entity should be placed in the DOM tree.
 *
 * @param currentCue
 * @param previousCue
 * @returns
 */

function getSubtreeFromCueNodes(
	currentCue: CueNode,
	previousCue?: CueNode,
): [root: Node, diffIndex: number, textNode: Text] {
	const textNode = document.createTextNode(currentCue.content);

	if (!currentCue.entities.length) {
		const fragment = new DocumentFragment();
		fragment.appendChild(textNode);
		return [fragment, 0, textNode];
	}

	if (!previousCue?.entities.length || previousCue.id !== currentCue.id) {
		return [entitiesToDOM(textNode, ...currentCue.entities), currentCue.entities.length, textNode];
	}

	let firstDifferentEntityIndex = 0;

	const longestCueEntitiesLength = Math.max(
		currentCue.entities.length,
		previousCue.entities.length,
	);

	for (
		let i = firstDifferentEntityIndex;
		i < longestCueEntitiesLength;
		i++, firstDifferentEntityIndex++
	) {
		if (!currentCue.entities[i] || !previousCue.entities[i]) {
			break;
		}

		const currentCueEntity = currentCue.entities[i] as Entities.TagEntity;
		const previousCueEntity = previousCue.entities[i] as Entities.TagEntity;

		if (
			currentCueEntity.type !== previousCueEntity.type ||
			currentCueEntity.tagType !== previousCueEntity.tagType
		) {
			break;
		}
	}

	return [
		entitiesToDOM(textNode, ...currentCue.entities.slice(firstDifferentEntityIndex)),
		firstDifferentEntityIndex,
		textNode,
	];
}
