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

interface QueuedStorageValues {
	attributes: Record<string, string> & UniquelyAnnotatedNode;
	styleIDREFs: string[];
}

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

		function processStyles(
			stylesAttributesList: (Record<string, string> & UniquelyAnnotatedNode)[],
			scope: Scope,
			retriveExternalStyle: (idref: string) => Record<string, string> | undefined,
		): void {
			const stylesIDREFSQueuedStorage = new Map<string, QueuedStorageValues>();

			/**
			 * Preregister all the provided styles in order to be accessible later
			 * as referential styles, even if they are not processed yet.
			 */
			for (const styleAttributes of stylesAttributesList) {
				if (!isUniquelyAnnotatedNode(styleAttributes)) {
					console.warn("Style with unknown 'xml:id' attribute, got ignored.");
					continue;
				}

				stylesIDREFSQueuedStorage.set(styleAttributes["xml:id"], {
					attributes: styleAttributes,
					styleIDREFs: styleAttributes["style"]?.split("\x20") || [],
				});
			}

			const stylesByTopology = processStylesByTopology(
				stylesIDREFSQueuedStorage,
				retriveExternalStyle,
			);

			for (const [id, styleAttributes] of stylesByTopology) {
				const style = Object.create(styleAttributes, {
					"xml:id": {
						value: id,
						enumerable: true,
					},
				});

				const ttmlStyle = createTTMLStyle(style, scope);

				if (!ttmlStyle) {
					console.warn("Style with unknown 'xml:id' attribute, got ignored.");
					continue;
				}

				stylesIDREFSStorage.set(id, ttmlStyle);
			}
		}

		return {
			parent: undefined,
			identifier: styleContextSymbol,
			get args() {
				return registeredStyles;
			},
			[onAttachedSymbol]() {
				processStyles(this.args, scope, (idref) => {
					return this.getStyleByIDRef(idref)?.styleAttributes;
				});
			},
			[onMergeSymbol](incomingContext: StyleContainerContext): void {
				processStyles(incomingContext.args, scope, (idref) => {
					return this.getStyleByIDRef(idref)?.styleAttributes;
				});
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

// ********************************************* //
// *** STYLE TOPOLOGY BUILDING AND RESOLVING *** //
// ********************************************* //
// region style topology

function processStylesByTopology(
	stylesIDREFSQueuedStorage: Map<string, QueuedStorageValues>,
	retrieveExternalStyle: (idref: string) => Record<string, string> | undefined,
) {
	const { inDegreeNodes, reverseDependencyList } = buildStylesTopology(stylesIDREFSQueuedStorage);

	const queue: string[] = [];

	/**
	 * Nodes that have no local incoming edges (no `style` attribute referencing
	 * another style in this block) get enqueued immediately.
	 */
	for (const styleID of stylesIDREFSQueuedStorage.keys()) {
		if (!inDegreeNodes.has(styleID)) {
			queue.push(styleID);
		}
	}

	const resolvedStyles = new Map<string, Record<StyleAttributeString, string>>();

	while (queue.length) {
		const id = queue.shift()!;
		const { attributes, styleIDREFs } = stylesIDREFSQueuedStorage.get(id)!;

		const finalStyleAttributes: Record<StyleAttributeString, string> = {};

		/**
		 * Iterate the original IDREF list to preserve the TTML2 §10.4.4.2 merge
		 * order — local and external refs interleaved exactly as written in the
		 * style attribute. Local deps are guaranteed resolved by Kahn's invariant.
		 */
		for (const idref of styleIDREFs) {
			const localResolvedDependency = resolvedStyles.get(idref);

			if (localResolvedDependency) {
				Object.assign(finalStyleAttributes, localResolvedDependency);
				continue;
			}

			const external = retrieveExternalStyle(idref);

			if (external) {
				Object.assign(finalStyleAttributes, external);
				continue;
			}

			console.warn(
				`Style '${id}' has a dependency on style '${idref}' that cannot be resolved. It will be ignored.`,
			);
		}

		resolvedStyles.set(
			id,
			Object.assign(
				//
				finalStyleAttributes,
				extractStyleAttributes(attributes),
			),
		);

		for (const dependent of reverseDependencyList.get(id) ?? []) {
			const remaining = inDegreeNodes.get(dependent)! - 1;
			inDegreeNodes.set(dependent, remaining);

			if (remaining === 0) {
				queue.push(dependent);
			}
		}
	}

	/**
	 * Per TTML2 spec:
	 * > A loop in a sequence of chained style references must
	 * > be considered an error.
	 *
	 * Any style still in `inDegreeNodes` with a count > 0 after the queue
	 * empties is definitively part of a cycle.
	 */
	for (const [id, remaining] of inDegreeNodes) {
		if (remaining === 0) {
			continue;
		}

		console.warn(`Style '${id}' forms a cyclic reference. Will be ignored.`);
	}

	return resolvedStyles;
}

interface StyleDependencyGraph {
	/**
	 * A counter map of how many local (same-`<styling>`) dependencies each style
	 * still has pending. Starts at the number of local IDREFs and is decremented
	 * by the notify-dependents step as each dependency is resolved. When it
	 * reaches zero the style is ready to be enqueued.
	 *
	 * Only styles that have at least one local IDREF appear here; styles with no
	 * local deps are seeded directly into the queue.
	 */
	inDegreeNodes: Map<string, number>;

	/**
	 * A map that contains the reversed list of dependencies
	 * between styles, hence which styles are waiting for
	 * another style.
	 *
	 * This will contain something like:
	 *
	 * `['s1', ['s2', 's3']]`
	 *
	 * meaning that s2 and s3 are waiting for s1 to be processed,
	 * so when s1 will be processed we can directly know which styles are
	 * waiting for it without iterating on the whole list of styles and
	 * their dependencies.
	 */
	reverseDependencyList: Map<string, string[]>;
}

function buildStylesTopology(
	stylesIDREFSQueuedStorage: Map<string, QueuedStorageValues>,
): StyleDependencyGraph {
	const inDegreeNodes = new Map<string, number>();
	const reverseDependencyList = new Map<string, string[]>();

	for (const [xmlId, { styleIDREFs }] of stylesIDREFSQueuedStorage) {
		if (!styleIDREFs.length) {
			continue;
		}

		/**
		 * A style might reference to a style that is not in the same
		 * `<styling>` element. We filter those out — they are resolved
		 * via `retrieveExternalStyle` during processing, not tracked here.
		 */
		const localIDREFsEdges = styleIDREFs.filter((edge) => stylesIDREFSQueuedStorage.has(edge));

		if (localIDREFsEdges.length) {
			inDegreeNodes.set(xmlId, localIDREFsEdges.length);
		}

		for (const edge of localIDREFsEdges) {
			const reverseDependencies = reverseDependencyList.get(edge) ?? [];

			/**
			 * Guard against registering the same dependent more than once for the same edge.
			 *
			 * A style may legally list the same local IDREF multiple times with an intervening
			 * distinct style, e.g. `style="s1 s2 s1"`. In that case `s3` appears twice in
			 * `localIDREFsEdges` for edge `s1`, so without this check `s3` would be enqueued
			 * twice when `s1` is resolved — causing it to be processed twice and its
			 * resolved attributes to be overwritten with a stale merge.
			 */
			if (!reverseDependencies.includes(xmlId)) {
				reverseDependencies.push(xmlId);
			}

			reverseDependencyList.set(edge, reverseDependencies);
		}
	}

	return {
		inDegreeNodes,
		reverseDependencyList,
	};
}

// *************************** //
// *** TTML STYLE CREATION *** //
// *************************** //
// region TTMLStyle

export interface TTMLStyle extends UniquelyAnnotatedNode {
	styleAttributes: Record<string, string>;
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
		styleAttributes: attributes,
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
