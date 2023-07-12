export enum TokenType {
	TAG /** Self-closed tag */,
	CDATA,
	COMMENT,
	START_TAG,
	END_TAG,
	STRING,
	PROCESSING_INSTRUCTION,
	VALIDATION_ENTITY,
}

export class Token {
	public readonly type: TokenType;
	public readonly content: string;
	public readonly attributes: Record<string, string>;

	private constructor(type: TokenType, name: string, attributes?: Record<string, string>) {
		this.type = type;
		this.content = name;
		this.attributes = attributes ?? ({} as Record<string, string>);
	}

	public static String(content: string): Token {
		return new Token(TokenType.STRING, content);
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

	public static ProcessingInstruction(content: string): Token {
		/** This data type is currently ignored. We don't need it (yet) */
		return new Token(TokenType.PROCESSING_INSTRUCTION, "ProcessingInstruction", undefined);
	}

	public static ValidationEntity(content: string): Token {
		/** This data type is currently ignored. We don't need it (yet) */
		return new Token(TokenType.VALIDATION_ENTITY, "ValidationEntity", undefined);
	}
}

interface RegionEndTagToken extends Token {
	type: TokenType.END_TAG;
	content: "region";
}

interface RegionTagToken extends Token {
	type: TokenType.TAG;
	content: "region";
}

export function isRegionTagToken(token: Token): token is RegionTagToken {
	return token.type === TokenType.TAG && token.content === "region";
}

export function isRegionEndTagToken(token: Token): token is RegionEndTagToken {
	return token.type === TokenType.END_TAG && token.content === "region";
}

interface StyleEndTagToken extends Token {
	type: TokenType.END_TAG;
	content: "style";
}

interface StyleTagToken extends Token {
	type: TokenType.TAG;
	content: "style";
}

export function isStyleTagToken(token: Token): token is StyleTagToken {
	return token.type === TokenType.TAG && token.content === "region";
}

export function isStyleEndTagToken(token: Token): token is StyleEndTagToken {
	return token.type === TokenType.END_TAG && token.content === "region";
}

export function isRegionStyleToken(token: Token, prevToken: Token): boolean {
	return token.content === "style" && prevToken.content === "region";
}
