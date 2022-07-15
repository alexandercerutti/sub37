import type { CueNode } from "@hsubs/server";

export class Renderer extends HTMLElement {
	private mainRegion = Object.assign(document.createElement("div"), {
		id: "scroll-window",
	});
	private scrollArea = Object.assign(document.createElement("div"), {
		id: "scroll-area",
	});

	private renderArea = new TreeOrchestrator();

	/**
	 * This strategy allows people to apply a roll-up captions
	 * animation (smooth) or a pop-on captions disappearance
	 * (discrete)
	 */

	private exitTransitionMode: "discrete" | "smooth" = "discrete";

	private currentCues: Set<CueNode> = new Set<CueNode>();

	public constructor() {
		super();

		const shadowRoot = this.attachShadow({ mode: "open" });
		const style = document.createElement("style");

		style.id = "host-styles";
		style.textContent = `
:host {
	left: 0; right: 0; bottom: 0; top: 0; position: absolute;
	display: flex;
	align-items: end;
	justify-content: center;
}

div#scroll-window {
	margin-bottom: 10px;
	width: 300px;
	overflow-y: hidden;
	background-color: rgba(0,0,0,0.4);
}

div#scroll-area {
	scroll-behavior: smooth;
	height: 3em;
}

div#scroll-area p {
  margin: 0;
  box-sizing: border-box;
}

#scroll-area p span {
  color: #FFF;
  background-color: rgba(0,0,0,0.7);
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

		this.mainRegion.appendChild(this.renderArea.root);

		shadowRoot.appendChild(style);
		shadowRoot.appendChild(this.mainRegion);

		const exitTransitionAttribute = this.getAttribute("exit-transition") ?? "discrete";

		if (exitTransitionAttribute === "discrete" || exitTransitionAttribute === "smooth") {
			this.exitTransitionMode = exitTransitionAttribute;
		}
	}

	public setCue(cueData?: CueNode[]) {
		if (!cueData?.length) {
			// cleanChildren(this.scrollArea);
			this.renderArea.cleanRoot();
			this.currentCues = new Set<CueNode>();
			return;
		}

		this.renderArea.renderCuesToHTML(cueData);

		/**
		 * @TODO Should we cache HTML Elements?
		 * By doing so sub-DOM might not get reloaded entirely
		 */

		// let latestCueId: string = "";
		// let latestHeight: number = 0;

		// /**
		//  * @TODO Should we cache HTML Elements?
		//  * By doing so sub-DOM might not get reloaded entirely
		//  */

		// cleanChildren(this.scrollArea);

		// for (const cueNode of cueData) {
		// let nextHeight: number = 0;

		// if (!cueNode.content.length) {
		// 	continue;
		// }

		// if (latestCueId !== cueNode.id) {
		// 	/** New line */
		// 	const line = addTextToRow(document.createTextNode(cueNode.content));

		// 	this.scrollArea.appendChild(line);
		// 	nextHeight = getElementHeight(line);
		// } else {
		// 	/** Maybe it will go on a new line */
		// 	const { children } = this.scrollArea;

		// 	const lastChild = children[children.length - 1] as HTMLParagraphElement;
		// 	const textNode = document.createTextNode(` ${cueNode.content}`);

		// 	addTextToRow(textNode, lastChild);

		// 	nextHeight = getElementHeight(children[children.length - 1] as HTMLParagraphElement);
		// 	const didParagraphWentOnNewLine = nextHeight > latestHeight;

		// 	if (didParagraphWentOnNewLine && latestHeight > 0) {
		// 		addTextToTextContainer(textNode, this.scrollArea);
		// 	}
		// }

		// latestHeight = nextHeight;
		// latestCueId = cueNode.id;
		// }

		/**
		 * To achieve a Youtube-like subtitle effect, when a cue is alone
		 * is it translated to the bottom of the X visible rows. A.k.a. 1.5em
		 * (at the current moment). Hence, we need to traslate vertically the
		 * whole block in steps of 1.5em (or "one line"), starting from 1.5 and
		 * then going negatively.
		 *
		 * 1.5 -> 0 -> -1.5 -> -3 -> -4.5
		 */

		// if (this.scrollArea.children.length) {
		// 	/**
		// 	 * @TODO This should probably be a property of the component
		// 	 */
		// 	const MAXIMUM_VISIBLE_ELEMENTS = 2;
		// 	const {
		// 		children: { length: childrenAmount },
		// 	} = this.scrollArea;

		// 	/**
		// 	 * We need to obtain the number of rows we should scroll of.
		// 	 *
		// 	 * - CHILDREN_AMOUNT + MAXIMUM_VISIBLE_ELEMENTS
		// 	 *
		// 	 * (-1) + 2 =  1  =>  1.5 *  1 =  1.5
		// 	 * (-2) + 2 =  0  =>  1.5 *  0 =  0.0
		// 	 * (-3) + 2 = -1  =>  1.5 * -1 = -1.5
		// 	 * (-4) + 2 = -2  =>  1.5 * -2 = -3.0
		// 	 */

		// 	const linesToBeScrolled = -childrenAmount + MAXIMUM_VISIBLE_ELEMENTS;

		// 	this.scrollArea.style.transform = `translateY(
		// 		${1.5 * linesToBeScrolled}em
		// 	)`;

		// 	this.scrollArea.style.transition = "";

		// 	if (this.exitTransitionMode === "smooth") {
		// 		if (linesToBeScrolled <= 0) {
		// 			this.scrollArea.style.transition = "transform .3s ease-in-out";
		// 		}
		// 	}
		// }

		// const newCues = getCuesDifference(this.currentCues, new Set(cueData));

		// if (!newCues.size) {
		// 	return;
		// }

		// this.currentCues = new Set(cueData);

		// if (this.exitTransitionMode === "discrete") {
		// 	/**
		// 	 * Not very optimal, we may alter the DOM every 0.25s.
		// 	 * Probably we should keep a cache or whatever and
		// 	 * check against it first...
		// 	 */

		// 	cleanChildren(this.mainRegion);

		// 	const region = new DocumentFragment();
		// 	const rows = new Map<string, HTMLDivElement>([]);

		// 	for (const cueNode of newCues) {
		// 		const rowElement = getRowById(region, rows, cueNode.id);
		// 		const cue = Object.assign(document.createElement("span"), {
		// 			textContent: getPresentableCueContent(cueNode),
		// 			id: cueNode.id,
		// 		});

		// 		rowElement.appendChild(cue);
		// 	}

		// 	this.mainRegion.appendChild(region);
		// } else {
		// 	const { children } = this.mainRegion;

		// 	if (!children.length) {
		// 		this.mainRegion.appendChild(document.createElement("p"));
		// 	}

		// 	for (const cueNode of newCues) {
		// 		const lastChild = children[children.length - 1] as HTMLParagraphElement;
		// 		const textNode = document.createTextNode(` ${cueNode.content}`);

		// 		addTextToRow(textNode, lastChild);

		// 		const nextHeight = getElementHeight(children[children.length - 1] as HTMLParagraphElement);
		// 		const didParagraphWentOnNewLine = nextHeight > this.latestHeight;

		// 		/*console.log("NEXT:", nextHeight, "LATEST:", latestHeight, didParagraphWentOnNewLine);*/

		// 		if (didParagraphWentOnNewLine && this.latestHeight > 0) {
		// 			addTextToTextContainer(textNode, this.mainRegion);

		// 			// if (shouldRemoveFirstChild(children)) {
		// 			// 	createDebouncedRemover();
		// 			// }
		// 		}

		// 		scrollToBottom(this.mainRegion);
		// 		this.saveLatestContainerHeight(nextHeight);
		// 	}
		// }
	}
}

function getPresentableCueContent(cueNode: CueNode): string {
	/** @TODO add entities */
	return cueNode.content;
}

class TreeOrchestrator {
	private _root = Object.assign(document.createElement("div"), {
		id: "scroll-area",
	});

	public get root() {
		return this._root;
	}

	public cleanRoot() {
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

		this.cleanRoot();

		const lines: Line[] = [];

		for (const cueNode of cueNodes) {
			let nextHeight: number = 0;

			if (!cueNode.content.length) {
				return;
			}

			if (latestCueId !== cueNode.id) {
				/** New line */
				const line = new Line();
				line.addText(cueNode.content);
				line.attachTo(this.root);

				nextHeight = line.getHeight();

				lines.push(line);
			} else {
				/** Maybe it will go on a new line */
				const lastLine = lines[lines.length - 1];
				const textNode = lastLine.addText(` ${cueNode.content}`);

				nextHeight = lastLine.getHeight();

				const didParagraphWentOnNewLine = nextHeight > latestHeight;

				if (didParagraphWentOnNewLine && latestHeight > 0) {
					const line = new Line();
					line.attachTo(this.root);
					line.addText(textNode);
					lines.push(line);
				}
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

			this.root.style.transition = "";

			// if (this.exitTransitionMode === "smooth") {
			if (linesToBeScrolled <= 0) {
				this.root.style.transition = "transform .5s ease-in-out";
			}
			// }
		}
	}
}

class Line {
	element: HTMLParagraphElement;

	public constructor() {
		const node = document.createElement("p");
		node.appendChild(document.createElement("span"));

		this.element = node;
	}

	public attachTo(root: HTMLElement) {
		root.appendChild(this.element);
	}

	public detachFrom(root: HTMLElement) {
		root.removeChild(this.element);
	}

	public addText(text: string | Text) {
		let node: Text;

		if (typeof text === "string") {
			node = document.createTextNode(text);
		} else {
			node = text;
		}

		return this.element.children[0].appendChild(node);
	}

	public getHeight() {
		const { height } = this.element.getBoundingClientRect();
		return Math.floor(height);
	}
}

customElements.define("captions-presenter", Renderer);
