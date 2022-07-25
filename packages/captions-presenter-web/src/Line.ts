export default class Line {
	element: HTMLParagraphElement;

	public constructor() {
		const node = document.createElement("p");
		node.appendChild(document.createElement("span"));

		this.element = node;
	}

	public attachTo(root: HTMLElement): void {
		root.appendChild(this.element);
	}

	public detachFrom(root: HTMLElement): void {
		root.removeChild(this.element);
	}

	public addText(text: string | Text): Text {
		let node: Text;

		if (typeof text === "string") {
			node = document.createTextNode(text);
		} else {
			node = text;
		}

		return this.element.children[0].appendChild(node);
	}

	public getHeight(): number {
		return Math.floor(this.element.offsetHeight);
	}
}
