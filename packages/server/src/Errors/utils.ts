const INDENT_REGEX = /\n/g;

function convertError(error: unknown) {
	if (error instanceof Error) {
		return error;
	}

	if (typeof error === "string") {
		return new Error(error);
	}

	if (typeof error === "object") {
		return new Error(JSON.stringify(error));
	}
}

export function formatError(error: unknown): string {
	const wrapperError = convertError(error);
	return `\t${wrapperError.toString().replace(INDENT_REGEX, "\n\t")}`;
}
