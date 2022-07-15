export default class Line {
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
