import { IntervalBinaryTree, Entities } from "@hsubs/server";
import type { CueNode, Region } from "@hsubs/server";

const rootElementSymbol = Symbol("to.root.element");

interface OrchestratorSettings {
	lines: number;
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

export default class TreeOrchestrator {
	private static DEFAULT_SETTINGS: OrchestratorSettings = {
		lines: 2,
		shiftDownFirstLine: false,
	};

	private [rootElementSymbol]: HTMLDivElement;

	private settings: OrchestratorSettings;

	public constructor(regionSettings: Region, parent: HTMLElement, settings?: OrchestratorSettings) {
		const root = Object.assign(document.createElement("div"), {
			className: "region",
		});

		this[rootElementSymbol] = root.appendChild(document.createElement("div"));

		this.settings = {
			...TreeOrchestrator.DEFAULT_SETTINGS,
			...settings,
			lines: regionSettings?.lines || settings?.lines || this.settings.lines,
		};

		const [originX, originY] = regionSettings?.getOrigin(
			parent.offsetWidth,
			parent.offsetHeight,
		) ?? [0, 70];

		const rootStyles: Partial<CSSStyleDeclaration> = {
			width: `${regionSettings?.width ?? 100}%`,
			height: `${this.settings.lines * 1.5}em`,
			left: `${originX}%`,
			top: `${originY}%`,
		};

		Object.assign(root.style, rootStyles);
	}

	public remove(): void {
		this.root.remove();
	}

	public get root(): HTMLElement {
		return this[rootElementSymbol].parentElement;
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

			cues.push(...splitCueNodesByBreakpoints(cueNode, entitiesTree));
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

function splitCueNodesByBreakpoints(
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

function entitiesToDOM(rootNode: Node, ...entities: Entities.GenericEntity[]): Node {
	const subRoot = new DocumentFragment();
	let latestNode: Node = rootNode;

	for (let i = entities.length - 1; i >= 0; i--) {
		const entity = entities[i];

		if (entity instanceof Entities.Tag) {
			const node = getHTMLElementByEntity(entity);

			if (entity.styles) {
				for (const [key, value] of Object.entries(entity.styles) as [string, string][]) {
					node.style.cssText += `${key}:${value};`;
				}
			}

			node.appendChild(latestNode);
			latestNode = node;
		}
	}

	subRoot.appendChild(latestNode);
	return subRoot;
}

function getHTMLElementByEntity(entity: Entities.Tag): HTMLElement {
	const element: HTMLElement = (() => {
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
				return document.createElement("span");
			}
		}
	})();

	for (const className of entity.classes) {
		element.classList.add(className);
	}

	return element;
}

function addNode(node: Node, content: Node): Node {
	node.appendChild(content);
	return node;
}

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

	if (!previousCue?.entities.length) {
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

		const currentCueEntity = currentCue.entities[i];
		const previousCueEntity = previousCue.entities[i];

		if (
			currentCueEntity.length !== previousCueEntity.length ||
			currentCueEntity.offset !== previousCueEntity.offset
		) {
			break;
		}
	}

	if (firstDifferentEntityIndex >= currentCue.entities.length) {
		/** We already reached that depth */
		const fragment = new DocumentFragment();
		fragment.appendChild(textNode);
		return [fragment, firstDifferentEntityIndex, textNode];
	}

	return [
		entitiesToDOM(textNode, ...currentCue.entities.slice(firstDifferentEntityIndex)),
		firstDifferentEntityIndex,
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
