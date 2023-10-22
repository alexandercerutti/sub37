import type { WithParent } from "./WithParent";

export interface Node<ContentType extends object> {
	content: ContentType;
}

export type NodeWithParent<ContentType extends object> = WithParent<Node<ContentType>>;
