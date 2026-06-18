export class ProcessorSelectorElement extends HTMLFormElement {
	private preferenceStorer = createPreferenceStorer("processor");

	constructor() {
		super();

		this.addEventListener("change", (e) => {
			if ((e.target as HTMLInputElement).getAttribute("type") === "radio") {
				this.preferenceStorer.save((e.target as HTMLElement).id);
			}
		});

		const childrenInputs = Array.from(this.querySelectorAll("input")) as HTMLInputElement[];

		if (childrenInputs.length) {
			const currentSelectedElement = this.preferenceStorer.get();
			childrenInputs.find((e) => e.id === currentSelectedElement)?.setAttribute("checked", "true");
		}
	}
}

function createPreferenceStorer(key: string) {
	return {
		save(value: string) {
			window.localStorage.setItem(key, value);
		},
		get() {
			return window.localStorage.getItem(key);
		},
	};
}

window.customElements.define("processor-selector", ProcessorSelectorElement, { extends: "form" });
