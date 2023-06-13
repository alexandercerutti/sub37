export enum TokenType {
	TAG /** Self-closed tag */,
	CDATA,
	COMMENT,
	START_TAG,
	END_TAG,
	PROCESSING_INSTRUCTION,
	VALIDATION_ENTITY,
}

export class Token {
	public readonly type: TokenType;
	public readonly tokenName: string;
	public readonly attributes: Record<string, string>;

	private constructor(type: TokenType, name: string, attributes?: Record<string, string>) {
		this.type = type;
		this.tokenName = name;
		this.attributes = attributes ?? ({} as Record<string, string>);
	}

	public static Tag(tagName: string, attributes: Record<string, string>): Token {
		return new Token(TokenType.TAG, tagName, attributes);
	}

	public static StartTag(tagName: string, attributes: Record<string, string>): Token {
		return new Token(TokenType.START_TAG, tagName, attributes);
	}

	public static EndTag(tagName: string): Token {
		return new Token(TokenType.END_TAG, tagName, undefined);
	}

	public static CData(content: string): Token {
		/** This data type is currently ignored. We don't need it (yet) */
		return new Token(TokenType.CDATA, "CDATA Tag", undefined);
	}

	public static Comment(content: string): Token {
		/** This data type is currently ignored. We don't need it (yet) */
		return new Token(TokenType.COMMENT, "Comment Tag", undefined);
	}

	public static ProcessingIntruction(content: string): Token {
		/** This data type is currently ignored. We don't need it (yet) */
		return new Token(TokenType.PROCESSING_INSTRUCTION, "ProcessingInstruction", undefined);
	}

	public static ValidationEntity(content: string): Token {
		/** This data type is currently ignored. We don't need it (yet) */
		return new Token(TokenType.VALIDATION_ENTITY, "ValidationEntity", undefined);
	}
}
