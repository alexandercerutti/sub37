import { isUniquelyAnnotatedNode } from "../Token.js";
import type { UniquelyAnnotatedNode } from "../Token.js";
import type { StyleAttributeString, SupportedCSSProperties } from "../parseStyle.js";
import {
	isStyleAttribute,
	parseAttributeValue,
	resolveStyleDefinitionByName,
	styleAppliesToElement,
} from "../parseStyle.js";
import type { Context, ContextFactory, Scope } from "./Scope";
import { onAttachedSymbol, onMergeSymbol } from "./Scope.js";

const styleContextSymbol = Symbol("style");

type ReferentialStyleChain = Partial<Record<"style", string>>;

type StyleContainerContextState = UniquelyAnnotatedNode &
	ReferentialStyleChain &
	Record<string, string>;

interface StyleContainerContext extends Context<
	StyleContainerContext,
	StyleContainerContextState[]
> {
	getStyleByIDRef(idref: string): TTMLStyle | undefined;
}

declare module "./Scope" {
	interface ContextDictionary {
		[styleContextSymbol]: StyleContainerContext;
	}
}

export function createStyleContainerContext(
	registeredStyles: StyleContainerContextState[],
): ContextFactory<StyleContainerContext> {
	return function (scope: Scope) {
		/**
		 * @see https://www.w3.org/TR/2018/REC-ttml2-20181108/#semantics-style-association-chained-referential
		 */
		const stylesIDREFSStorage = new Map<string, TTMLStyle>();

		return {
			parent: undefined,
			identifier: styleContextSymbol,
			get args() {
				return registeredStyles;
			},
			[onAttachedSymbol]() {
				const { args } = this;

				for (const styleAttributes of args) {
					if (!styleAttributes["xml:id"]) {
						console.warn("Style with unknown 'xml:id' attribute, got ignored.");
						continue;
					}

					const finalAttributes = Object.assign({}, styleAttributes);

					if (styleAttributes["style"]?.length) {
						const chainedReferentialStylesIDRefs = new Set(styleAttributes["style"].split("\x20"));

						for (const idref of chainedReferentialStylesIDRefs) {
							/**
							 * A loop in a sequence of chained style references must be considered an error.
							 * @see https://w3c.github.io/ttml2/#semantics-style-association-chained-referential
							 *
							 * However, if this check of checking if an idref already exists will
							 * get removed, we'll have to find out a different way to track
							 * already used styles. Right now we save ourselves by blocking current
							 */

							/**
							 * @see https://w3c.github.io/ttml2/#semantics-style-association-chained-referential
							 */
							const chainedReferentialStyle =
								stylesIDREFSStorage.get(idref) || this.parent?.getStyleByIDRef(idref) || undefined;

							if (!chainedReferentialStyle) {
								console.warn(
									`Chained Style Referential: style '${idref}' not found or not yet defined. Will be ignored.`,
								);
								continue;
							}

							Object.assign(finalAttributes, chainedReferentialStyle);
						}
					}

					const currentStyleId = styleAttributes["xml:id"];
					const resolvedStyleId = resolveIDREFConflict(stylesIDREFSStorage, currentStyleId);

					const style = Object.create(finalAttributes, {
						"xml:id": {
							value: resolvedStyleId,
							enumerable: true,
						},
					});

					const ttmlStyle = createTTMLStyle(style, scope);

					if (!ttmlStyle) {
						console.warn("Style with unknown 'xml:id' attribute, got ignored.");
						continue;
					}

					stylesIDREFSStorage.set(resolvedStyleId, ttmlStyle);
				}
			},
			[onMergeSymbol](incomingContext: StyleContainerContext): void {
				const { args } = incomingContext;

				for (const style of args) {
					const ttmlStyle = createTTMLStyle(style, scope);

					if (!ttmlStyle) {
						console.warn("Style with unknown 'xml:id' attribute, got ignored.");
						continue;
					}

					stylesIDREFSStorage.set(ttmlStyle["xml:id"], ttmlStyle);
				}
			},
			getStyleByIDRef(idref: string): TTMLStyle | undefined {
				const styleFromStorage = stylesIDREFSStorage.get(idref);

				if (styleFromStorage) {
					return styleFromStorage;
				}

				const styleFromParent = this.parent?.getStyleByIDRef(idref);

				if (!styleFromParent) {
					console.warn(`Cannot retrieve style id '${idref}'. Not provided.`);
					return undefined;
				}

				return styleFromParent;
			},
		};
	};
}

export function readScopeStyleContainerContext(scope: Scope): StyleContainerContext | undefined {
	return scope.getContextByIdentifier(styleContextSymbol);
}

/**
 * > If the same IDREF, _ID1_, appears more than one time in the value of a style attribute,
 * > then there should be an intervening IDREF, _ID2_, where _ID2_ is not equal to _ID1_.
 *
 * > This constraint is intended to discourage the use of redundant referential styling
 * > while still allowing the same style to be referenced multiple times in order to
 * > potentially override prior referenced styles, e.g., when an intervening, distinct
 * > style is referenced in the IDREFS list.
 *
 * @TODO this is out of standard. I didn't understand correctly what the text was intending
 * to say. This should be re-visited and potentially removed.
 *
 * @param idrefsMap
 * @param id
 * @returns
 */

function resolveIDREFConflict(idrefsMap: Map<string, TTMLStyle>, id: string): string {
	if (!idrefsMap.has(id)) {
		return id;
	}

	let styleConflictOverrideIdentifier = parseInt(id.match(/--(\d{1,})/)?.[1] ?? "");

	if (Number.isNaN(styleConflictOverrideIdentifier)) {
		return id;
	}

	while (idrefsMap.has(`${id}--${styleConflictOverrideIdentifier}`)) {
		styleConflictOverrideIdentifier++;
	}

	return id.replace(
		`--${styleConflictOverrideIdentifier}`,
		`--${styleConflictOverrideIdentifier + 1}`,
	);
}

export interface TTMLStyle extends UniquelyAnnotatedNode {
	/**
	 * Retrieves actualy styles for an element
	 *
	 * @param element
	 */
	apply(element: string): SupportedCSSProperties;
}

function createTTMLStyle(attributes: Record<string, string>, scope: Scope): TTMLStyle | undefined {
	if (!isUniquelyAnnotatedNode(attributes)) {
		return undefined;
	}

	const style = {
		"xml:id": attributes["xml:id"],
		styleAttributes: extractStyleAttributes(attributes),
		apply(element: string): SupportedCSSProperties {
			return convertAttributesToCSS(this.styleAttributes, scope, element);
		},
	};

	return style;
}

function extractStyleAttributes(
	attributes: Record<string, string>,
): Record<StyleAttributeString, string> {
	const validAttributes: Record<StyleAttributeString, string> = {};

	for (const [attrName, attr] of Object.entries(attributes)) {
		if (!isStyleAttribute(attrName)) {
			continue;
		}

		validAttributes[attrName] = attr;
	}

	return validAttributes;
}

/**
 * Converts TTML attributes to CSS properties for a specific element.
 *
 * @param attributes
 * @param scope
 * @param sourceElementName
 * @returns
 */
function convertAttributesToCSS(
	attributes: Record<string, string>,
	scope: Scope,
	sourceElementName: string,
): SupportedCSSProperties {
	const convertedAttributes: SupportedCSSProperties = {};

	/**
	 * Not using Object.entries or "for..of" because they are not
	 * able to detect enumerable keys in prototype chain, and we
	 * are using them
	 */

	for (const attributeKey in attributes) {
		const definition = resolveStyleDefinitionByName(attributeKey);

		if (!definition || !styleAppliesToElement(definition, scope, sourceElementName)) {
			continue;
		}

		const value = attributes[attributeKey]!;

		const collectedValues = parseAttributeValue(definition.syntax, value);

		if (collectedValues === null) {
			continue;
		}

		const mapped = definition.toCSS(scope, collectedValues, sourceElementName);

		if (mapped === null) {
			continue;
		}

		for (const [mappedKey, mappedValue] of mapped) {
			convertedAttributes[mappedKey] = mappedValue;
		}
	}

	return convertedAttributes;
}
