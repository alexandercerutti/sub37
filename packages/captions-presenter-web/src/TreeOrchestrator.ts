import { CueNode } from "@hsubs/server";
import Line from "./Line.js";

export default class TreeOrchestrator {
	private _root = Object.assign(document.createElement("div"), {
		id: "scroll-area",
	});

	public get root() {
		return this._root;
	}

	public wipeEffects() {
		this.root.style.transform = "";
		this.root.style.transition = "";
	}

	public wipeTree() {
		for (let node: Node; (node = this.root.firstChild); ) {
			this.root.removeChild(node);
		}
	}

	public renderCuesToHTML(cueNodes: CueNode[]) {
		let latestCueId: string = "";
		let latestHeight: number = 0;

		/**
		 * @TODO Should we cache HTML Elements?
		 * By doing so sub-DOM might not get reloaded entirely
		 */

		this.wipeTree();

		const lines: Line[] = [];
		const items: CueNode[] = [...cueNodes];

		for (let i = 0; i < items.length; i++) {
			let nextHeight: number = 0;
			let cueNode = items[i];

			if (!cueNode.content.length) {
				continue;
			}

			/**
			 * Splitting phrases so we can keep track of the
			 * actual occupied lines
			 */
			const cueWords = cueNode.content.trim().split(/\x20|\x09|\x0C|\x0A/);

			if (cueWords.length > 1) {
				const cuesWithWordContent = cueWords.map((word) =>
					Object.create(cueNode, {
						content: {
							value: word,
						},
					}),
				);

				items.splice(i, 1, ...cuesWithWordContent);
				/** Refresh pointer */
				cueNode = items[i];
			}

			if (latestCueId !== cueNode.id) {
				const line = new Line();
				lines.push(line);
				line.attachTo(this.root);
			}

			const lastLine = lines[lines.length - 1];
			const textNode = lastLine.addText(`${i > 0 ? "\x20" : ""}${cueNode.content}`);
			nextHeight = lastLine.getHeight();

			if (nextHeight > latestHeight && latestHeight > 0) {
				const line = new Line();
				lines.push(line);
				textNode.textContent.trim();
				line.addText(textNode);
				line.attachTo(this.root);
			}

			latestHeight = nextHeight;
			latestCueId = cueNode.id;
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
