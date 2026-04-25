import { Entities } from "@sub37/server";

class Sub37Region extends HTMLElement {
	private readonly sheet = new CSSStyleSheet();

	public constructor() {
		super();

		const shadow = this.attachShadow({
			mode: "open",
		});

		const baseSheet = new CSSStyleSheet();

		baseSheet.insertRule(`
			:host {
				display: block;
			}
			`);

		baseSheet.insertRule(`
			#surface {
				display: flex;
				flex-direction: column;
				position: absolute;
				inset: 0;
				overflow: hidden;
			}
		`);

		const surface = document.createElement("div");
		surface.id = "surface";
		surface.appendChild(document.createElement("slot"));

		shadow.adoptedStyleSheets = [baseSheet, this.sheet];
		shadow.appendChild(surface);
	}

	/**
	 * Apply region-scoped entities to the visual surface.
	 *
	 * @param entities Region-scoped entity list from `Region.entities`.
	 */
	public applyEntities(entities: Entities.AllEntities[]): void {
		const staticStyles: Record<string, string> = {};

		for (const entity of entities) {
			if (Entities.isLocalStyleEntity(entity)) {
				Object.assign(staticStyles, entity.styles);
			}
		}

		let css = "";

		const staticEntries = Object.entries(staticStyles);

		if (staticEntries.length) {
			css += `#surface {`;

			for (const [prop, value] of staticEntries) {
				css += `${prop}: ${value};`;
			}

			css += `}\n`;
		}

		this.sheet.replaceSync(css);
	}
}

customElements.define("sub37-region", Sub37Region);

export type { Sub37Region };
