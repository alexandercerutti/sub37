import { IntervalBinaryTree } from "@hsubs/server";
import { CueNode, Entities } from "@hsubs/server";

export default class TreeOrchestrator {
	private _root = Object.assign(document.createElement("div"), {
		id: "scroll-area",
	});

	public get root(): HTMLDivElement {
		return this._root;
	}

	public wipeEffects(): void {
		this.root.style.transform = "";
		this.root.style.transition = "";
	}

	public wipeTree(): void {
		for (let node: Node; (node = this.root.firstChild); ) {
			this.root.removeChild(node);
		}
	}

	public renderCuesToHTML(cueNodes: CueNode[]): void {
		/**
		 * @TODO Should we cache HTML Elements?
		 * By doing so sub-DOM might not get reloaded entirely
		 */

		this.wipeTree();

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
				this.root.appendChild(line);
			}

			const nextHeight = getLineHeight(line);

			if (nextHeight > latestHeight && latestHeight > 0) {
				let textParentNode = textNode.parentNode as HTMLElement;
				const subTreeClone = entitiesToDOM(textNode, ...cue.entities);

				line = commitDOMTree(undefined, subTreeClone, cue.entities.length);

				while (!textParentNode.childNodes.length) {
					/** Cleaning up empty parents */
					const node = textParentNode;
					textParentNode = textParentNode.parentNode as HTMLElement;
					node.remove();
				}

				this.root.appendChild(line);
			} else if (i > 0) {
				textNode.textContent = `\x20${textNode.textContent}`;
			}

			latestHeight = nextHeight;
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

		if (this.root.children.length) {
			/**
			 * @TODO This should probably be a property of the component
			 */
			const MAXIMUM_VISIBLE_ELEMENTS = 2;
			const {
				children: { length: childrenAmount },
			} = this.root;

			/**
			 * We need to obtain the number of rows we should scroll of.
			 *
			 * - CHILDREN_AMOUNT + MAXIMUM_VISIBLE_ELEMENTS
			 *
			 * (-1) + 2 =  1  =>  1.5 *  1 =  1.5
			 * (-2) + 2 =  0  =>  1.5 *  0 =  0.0
			 * (-3) + 2 = -1  =>  1.5 * -1 = -1.5
			 * (-4) + 2 = -2  =>  1.5 * -2 = -3.0
			 */

			const linesToBeScrolled = -childrenAmount + MAXIMUM_VISIBLE_ELEMENTS;

			this.root.style.transform = `translateY(
				${1.5 * linesToBeScrolled}em
			)`;

			if (linesToBeScrolled <= 0) {
				this.root.style.transition = "transform .5s ease-in-out";
			}
		}
	}
}

function splitCueNodesByBreakpoints(
	cueNode: CueNode,
	entitiesTree: IntervalBinaryTree<Entities.GenericEntity>,
): CueNode[] {
	let previousContentBreakIndex: number = 0;
	const cues: CueNode[] = [];

	for (let i = 0; i < cueNode.content.length; i++) {
		/**
		 * Reordering because IBT serves nodes from left to right,
		 * but left nodes are the smallest. In case of a global entity,
		 * it is inserted as the first node. Hence, it will will result
		 * as the last entity here. If so, we render wrong elements.
		 */

		const entitiesAtCoordinates = (entitiesTree.getCurrentNodes(i) ?? []).sort(
			reorderEntitiesComparisonFn,
		);

		if (shouldCueNodeBreak(cueNode.content, entitiesAtCoordinates, i)) {
			const content = cueNode.content.slice(previousContentBreakIndex, i + 1).trim();

			cues.push(
				Object.create(cueNode, {
					content: {
						value: content,
					},
					entities: {
						value: entitiesAtCoordinates,
					},
				}),
			);

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
	if (currentIndex === 0) {
		return false;
	}

	const char = cueNodeContent[currentIndex];

	return (
		isCharacterWhitespace(char) ||
		indexMatchesEntityEnd(currentIndex, entitiesAtCoordinates) ||
		isCueContentEnd(cueNodeContent, currentIndex)
	);
}

function isCharacterWhitespace(char: string): boolean {
	return char === "\x20" || char === "\x09" || char === "\x0C" || char === "\x0A";
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
	/**
	 * We want to ensure that all the text nodes are in, at least,
	 * a span element in the root line element.
	 */

	const isSubrootContentSpanWrapped = cueSubTreeRoot.lastChild instanceof HTMLSpanElement;
	const root = rootNode || createLine(!isSubrootContentSpanWrapped);

	addNode(
		getNodeAtDepth(diffDepth, isSubrootContentSpanWrapped ? root : root.lastChild),
		cueSubTreeRoot,
	);

	return root as HTMLElement;
}

function createLine(addSpan: boolean = false) {
	const node = document.createElement("p");

	if (addSpan) {
		node.appendChild(document.createElement("span"));
	}

	return node;
}

function getLineHeight(line: HTMLElement) {
	return Math.floor(line.offsetHeight);
}

function getNodeAtDepth(index: number, node: Node) {
	let latestNodePointer: Node = node;

	while (index > 0 && latestNodePointer.lastChild) {
		if (latestNodePointer.lastChild.nodeType !== 1) {
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
					console.log(key, value);
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
