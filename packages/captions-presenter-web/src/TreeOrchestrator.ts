import { CueNode, Entities, IntervalBinaryTree } from "@hsubs/server";
import Line from "./Line.js";

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
				const entitiesAtCoordinates = entitiesTree
					.getCurrentNodes(i)
					.filter((e) => !(e.offset === 0 && e.length === cueNode.content.length));

				const shouldBreakCue =
					isCharacterWhitespace(char) || indexMatchesEntityEnd(i, entitiesAtCoordinates);

				if (shouldBreakCue) {
					cues.push(
						Object.create(cueNode, {
							content: {
								value: cueNode.content.slice(previousContentBreakIndex, i),
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

		let latestCueId: string = "";
		let latestHeight: number = 0;
		const lines: Line[] = [];

		for (let i = 0; i < cues.length; i++) {
			const cue = cues[i];

			if (latestCueId !== cue.id) {
				const line = new Line();
				lines.push(line);
				line.attachTo(this.root);
			}

			const lastLine = lines[lines.length - 1];
			const textNode = lastLine.addText(`${i > 0 ? "\x20" : ""}${cue.content}`);
			const nextHeight = lastLine.getHeight();

			if (nextHeight > latestHeight && latestHeight > 0) {
				const line = new Line();
				lines.push(line);
				textNode.textContent.trim();
				line.addText(textNode);
				line.attachTo(this.root);
			}

			latestHeight = nextHeight;
			latestCueId = cue.id;
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

function isCharacterWhitespace(char: string) {
	return char === "\x20" || char === "\x09" || char === "\x0C" || char === "\x0A";
}

function indexMatchesEntityEnd(index: number, entities: Entities.GenericEntity[]) {
	if (!entities.length) {
		return false;
	}

	const lastEntity = entities[entities.length - 1];
	return lastEntity.offset + lastEntity.length === index;
}
