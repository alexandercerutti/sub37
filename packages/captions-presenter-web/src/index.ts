import type { CueNode } from "@hsubs/server";

export class Renderer extends HTMLElement {
	private mainRegion = Object.assign(document.createElement("div"), {
		id: "scroll-window",
	});
	private scrollArea = Object.assign(document.createElement("div"), {
		id: "scroll-area",
	});

	/**
	 * This strategy allows people to apply a roll-up captions
	 * animation (smooth) or a pop-on captions disappearance
	 * (discrete)
	 */

	private exitTransitionMode: "discrete" | "smooth" = "discrete";

	private latestHeight: number = 0;
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
	/**
	 * Space around text without letting
	 * overflow being seen
	 */
	overflow-y: hidden;
	/*border: 5px solid transparent;*/
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

		this.mainRegion.appendChild(this.scrollArea);

		shadowRoot.appendChild(style);
		shadowRoot.appendChild(this.mainRegion);

		const exitTransitionAttribute = this.getAttribute("exit-transition") ?? "discrete";

		if (exitTransitionAttribute === "discrete" || exitTransitionAttribute === "smooth") {
			this.exitTransitionMode = exitTransitionAttribute;
		}
	}

	public setCue(cueData?: CueNode[]) {
		if (!cueData?.length) {
			cleanChildren(this.scrollArea);
			this.currentCues = new Set<CueNode>();
			return;
		}

		let latestCueId: string = "";

		cleanChildren(this.scrollArea);

		for (const cueNode of cueData) {
			let nextHeight: number = 0;

			if (latestCueId !== cueNode.id) {
				/** New line */

				const line = addTextToRow(document.createTextNode(cueNode.content));

				this.scrollArea.appendChild(line);
				nextHeight = getElementHeight(line);
			} else {
				/** Maybe will go on a new line */
				const { children } = this.scrollArea;

				const lastChild = children[children.length - 1] as HTMLParagraphElement;
				const textNode = document.createTextNode(` ${cueNode.content}`);

				addTextToRow(textNode, lastChild);

				nextHeight = getElementHeight(children[children.length - 1] as HTMLParagraphElement);
				const didParagraphWentOnNewLine = nextHeight > this.latestHeight;

				if (didParagraphWentOnNewLine && this.latestHeight > 0) {
					addTextToTextContainer(textNode, this.scrollArea);
				}
			}

			if (this.scrollArea.children.length == 1) {
				this.scrollArea.style.transform = "translateY(1.5em)";
			} else {
				Object.assign(this.scrollArea.style, {
					transition: "transform .5s ease-out",
					transform: "translateY(0)",
				});
			}

			this.saveLatestContainerHeight(nextHeight);

			if (this.exitTransitionMode === "smooth") {
				/** Set scroll-behavior on element? */
			}

			scrollToBottom(this.scrollArea);
			latestCueId = cueNode.id;
		}

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

	private saveLatestContainerHeight(height: number) {
		this.latestHeight = height;
	}
}

function cleanChildren(region: HTMLDivElement) {
	for (const child of Array.from(region.childNodes)) {
		region.removeChild(child);
	}
}

function getRowById(region: DocumentFragment, rows: Map<string, HTMLDivElement>, id: string) {
	const rowElement = rows.get(id);

	if (rowElement) {
		return rowElement;
	}

	const newRowElement = document.createElement("div");
	rows.set(id, newRowElement);
	region.appendChild(newRowElement);

	return newRowElement;
}

function getPresentableCueContent(cueNode: CueNode): string {
	/** @TODO add entities */
	return cueNode.content;
}

function addTextToTextContainer(textNode: Text, container: HTMLDivElement) {
	container.appendChild(addTextToRow(textNode));
}

function addTextToRow(textNode: Text, nextParagraph = document.createElement("p")) {
	nextParagraph.appendChild(
		addTextToSpan(textNode, (nextParagraph.children as HTMLCollectionOf<HTMLSpanElement>)?.[0]),
	);

	return nextParagraph;
}

function addTextToSpan(textNode: Text, span = document.createElement("span")) {
	span.appendChild(textNode);
	return span;
}

function scrollToBottom(container: HTMLDivElement) {
	/** Smooth scrolling via CSS */
	container.scrollTop = container.scrollHeight;
}

function getElementHeight(child: HTMLElement) {
	const { height } = child.getBoundingClientRect();
	return Math.floor(height);
}

function getCuesDifference(current: Set<CueNode>, next: Set<CueNode>) {
	if (!current.size) {
		return next;
	}

	const difference = new Set(next);

	for (const cue of current) {
		difference.delete(cue);
	}

	return difference;
}

customElements.define("captions-presenter", Renderer);
