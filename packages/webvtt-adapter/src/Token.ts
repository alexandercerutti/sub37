export enum TokenType {
	STRING,
	START_TAG,
	END_TAG,
	TIMESTAMP,
}

type Boundaries = { start: number; end: number };

export class Token {
	public annotations: string[];
	public classes: string[];
	public offset: number;
	public length: number;

	public readonly type: TokenType;
	public readonly content: string;

	private constructor(type: TokenType, content: string) {
		this.type = type;
		this.content = content;
	}

	public static String(content: string, boundaries: Boundaries): Token {
		const token = new Token(TokenType.STRING, content);

		token.length = boundaries.end - boundaries.start;
		token.offset = boundaries.start;

		return token;
	}

	public static StartTag(
		tagName: string,
		boundaries: Boundaries,
		classes: string[] = [],
		annotations: string[] = [],
	): Token {
		const token = new Token(TokenType.START_TAG, tagName);

		token.length = boundaries.end - boundaries.start;
		token.offset = boundaries.start;
		token.classes = classes;
		token.annotations = annotations;

		return token;
	}

	public static EndTag(tagName: string, boundaries: Boundaries): Token {
		const token = new Token(TokenType.END_TAG, tagName);

		token.length = boundaries.end - boundaries.start;
		token.offset = boundaries.start;

		return token;
	}

	public static TimestampTag(timestampRaw: string, boundaries: Boundaries): Token {
		const token = new Token(TokenType.TIMESTAMP, timestampRaw);

		token.length = boundaries.end - boundaries.start;
		token.offset = boundaries.start;

		return token;
	}
}
