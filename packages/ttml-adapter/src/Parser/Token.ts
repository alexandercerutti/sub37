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

export enum TokenType {
	CDATA,
	COMMENT,
	START_TAG,
	END_TAG,
	STRING,
	PROCESSING_INSTRUCTION,
	VALIDATION_ENTITY,
}

interface PositionDetails {
	line: number;
	column: number;
	offset: number;
}

export class Token {
	public readonly type: TokenType;
	public readonly content: string;
	public readonly attributes: Record<string, string>;
	public readonly position: PositionDetails;

	private constructor(
		type: TokenType,
		name: string,
		position: PositionDetails,
		attributes?: Record<string, string>,
	) {
		this.type = type;
		this.content = name;
		this.attributes = attributes ?? ({} as Record<string, string>);
		this.position = position;
	}

	public static String(content: string, line: number, column: number, offset: number): Token {
		return new Token(TokenType.STRING, content, { line, column, offset });
	}

	public static StartTag(
		tagName: string,
		attributes: Record<string, string>,
		line: number,
		column: number,
		offset: number,
	): Token {
		return new Token(TokenType.START_TAG, tagName, { line, column, offset }, attributes);
	}

	public static EndTag(tagName: string, line: number, column: number, offset: number): Token {
		return new Token(TokenType.END_TAG, tagName, { line, column, offset });
	}

	public static CData(_content: string, line: number, column: number, offset: number): Token {
		/** This data type is currently ignored. We don't need it (yet) */
		return new Token(TokenType.CDATA, "CDATA Tag", { line, column, offset });
	}

	public static Comment(_content: string, line: number, column: number, offset: number): Token {
		/** This data type is currently ignored. We don't need it (yet) */
		return new Token(TokenType.COMMENT, "Comment Tag", { line, column, offset });
	}

	public static ProcessingInstruction(
		_content: string,
		line: number,
		column: number,
		offset: number,
	): Token {
		/** This data type is currently ignored. We don't need it (yet) */
		return new Token(TokenType.PROCESSING_INSTRUCTION, "ProcessingInstruction", {
			line,
			column,
			offset,
		});
	}

	public static ValidationEntity(
		_content: string,
		line: number,
		column: number,
		offset: number,
	): Token {
		/** This data type is currently ignored. We don't need it (yet) */
		return new Token(TokenType.VALIDATION_ENTITY, "ValidationEntity", { line, column, offset });
	}
}
