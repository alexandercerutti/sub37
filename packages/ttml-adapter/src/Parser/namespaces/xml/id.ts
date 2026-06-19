export type IDREF = string;

/**
 * @see https://www.w3.org/TR/2005/REC-xml-id-20050909
 */
export interface UniquelyAnnotatedNode {
	"xml:id": IDREF;
}

export function isUniquelyAnnotatedNode<T extends Record<string, string>>(
	node: T,
): node is T & UniquelyAnnotatedNode {
	return "xml:id" in node;
}

/**
 * Generates a synthetic xml:id when none is provided by the document.
 * The suffix is a random integer to avoid collisions between implied elements.
 */
export function generateSyntheticId(prefix: string): string {
	return `${prefix}:${Math.floor(Math.random() * (500 - 100) + 100)}`;
}
