import type { CueNode } from "@hsubs/server";

export class Renderer extends HTMLElement {
	private mainRegion = document.createElement("div");

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
:host { left: 0; right: 0; bottom: 0; top: 0; position: absolute; }
`;

		shadowRoot.appendChild(style);
		shadowRoot.appendChild(this.mainRegion);

		const exitTransitionAttribute = this.getAttribute("exit-transition");

		if (
			exitTransitionAttribute &&
			(exitTransitionAttribute === "discrete" || exitTransitionAttribute === "smooth")
		) {
			this.exitTransitionMode = exitTransitionAttribute;
		}
	}

	public setCue(cueData?: CueNode[]) {
		if (!cueData?.length) {
			cleanChildren(this.mainRegion);
			this.currentCues = new Set<CueNode>();
			return;
		}

		const newCues = getCuesDifference(this.currentCues, new Set(cueData));

		if (!newCues.size) {
			return;
		}

		this.currentCues = new Set(cueData);

		if (this.exitTransitionMode === "discrete") {
			/**
			 * Not very optimal, we may alter the DOM every 0.25s.
			 * Probably we should keep a cache or whatever and
			 * check against it first...
			 */

			cleanChildren(this.mainRegion);

			const region = new DocumentFragment();
			const rows = new Map<string, HTMLDivElement>([]);

			for (const cueNode of newCues) {
				const rowElement = getRowById(region, rows, cueNode.id);
				const cue = Object.assign(document.createElement("span"), {
					textContent: getPresentableCueContent(cueNode),
					id: cueNode.id,
				});

				rowElement.appendChild(cue);
			}

			this.mainRegion.appendChild(region);
		} else {
			/**
			 * @TODO implement smooth transition
			 */

			const { children } = this.mainRegion;

			if (!children.length) {
				this.mainRegion.appendChild(document.createElement("p"));
			}

			for (const cueNode of newCues) {
				const lastChild = children[children.length - 1] as HTMLParagraphElement;
				const textNode = document.createTextNode(` ${cueNode.content}`);

				addTextToRow(textNode, lastChild);

				const nextHeight = getElementHeight(children[children.length - 1] as HTMLParagraphElement);
				const didParagraphWentOnNewLine = nextHeight > this.latestHeight;

				if (didParagraphWentOnNewLine && this.latestHeight > 0) {
					addTextToTextContainer(textNode, this.mainRegion);

					// if (shouldRemoveFirstChild(children)) {
					// 	createDebouncedRemover();
					// }
				}

				scrollToBottom(this.mainRegion);
				this.saveLatestContainerHeight(nextHeight);
			}
		}
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
