export type WithParent<NodeType extends object> = [NodeType] extends [infer DataType]
	? DataType & {
			parent: WithParent<NodeType>;
	  }
	: never;
