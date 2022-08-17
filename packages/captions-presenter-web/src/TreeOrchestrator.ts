import { IntervalBinaryTree } from "@hsubs/server";
import type { CueNode, Entities } from "@hsubs/server";

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

			let previousContentBreakIndex = 0;

			for (let i = 0; i < cueNode.content.length; i++) {
				const char = cueNode.content[i];
				const entitiesAtCoordinates =
					entitiesTree.getCurrentNodes(i)?.filter((e) => e.length !== cueNode.content.length) ?? [];

				const shouldBreakCue =
					i > 0 &&
					(isCharacterWhitespace(char) ||
						indexMatchesEntityEnd(i, entitiesAtCoordinates) ||
						isCueContentEnd(cueNode, i));

				if (shouldBreakCue) {
					cues.push(
						Object.create(cueNode, {
							content: {
								value: cueNode.content.slice(previousContentBreakIndex, i + 1).trim(),
							},
							entities: {
								value: entitiesAtCoordinates,
							},
						}),
					);

					previousContentBreakIndex = i + 1;
				}
			}
		}

		let latestCueId = "";
		let latestNode: HTMLElement = undefined;
		let latestHeight: number = 0;

		for (let i = 0; i < cues.length; i++) {
			const cue = cues[i];

			if (latestCueId !== cue.id) {
				latestNode = undefined;
			}

			let line = latestNode || createLine();

			const node = createNode(`${i > 0 ? "\x20" : ""}${cue.content}`);
			line.children[0].appendChild(node);
			this.root.appendChild(line);

			const nextHeight = getLineHeight(line);

			if (nextHeight > latestHeight && latestHeight > 0) {
				line = createLine();
				node.textContent = node.textContent.trim();
				line.children[0].appendChild(node);
				this.root.appendChild(line);
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

function isCueContentEnd(cueNode: CueNode, index: number): boolean {
	return cueNode.content.length - 1 === index;
}

function createLine(lineStyles?: any[]) {
	const node = document.createElement("p");

	const spanNode = node.appendChild(document.createElement("span"));

	/**
	 * @TODO add styles to spanNode once determined the format of styles
	 */

	return node;
}

function createNode(content: string | Text, styles?: any[]) {
	const node = content instanceof Text ? content : document.createTextNode(content);

	if (!styles?.length) {
		return node;
	}

	const styleContainer = document.createElement("span");

	/** @TODO apply styles to span one determined the format */

	styleContainer.appendChild(node);
}

function getLineHeight(line: HTMLElement) {
	return Math.floor(line.offsetHeight);
}
