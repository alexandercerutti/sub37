const INDENT_REGEX = /\n/g;

function convertError(error: unknown): Error {
	if (error instanceof Error) {
		return error;
	}

	if (typeof error === "string") {
		return new Error(error);
	}

	return new Error(JSON.stringify(error));
}

export function formatError(error: unknown): string {
	const wrapperError = convertError(error);
	return `\t${wrapperError.toString().replace(INDENT_REGEX, "\n\t")}`;
}
