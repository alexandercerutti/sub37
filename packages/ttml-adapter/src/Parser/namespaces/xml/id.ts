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
