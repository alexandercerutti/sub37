import type { Context, ContextFactory, Scope } from "./Scope.js";

const errorContextSymbol = Symbol("error");

interface ReportedError {
	error: Error;
	critical: boolean;
	currentTokenOffset: number;
}

interface ErrorContext extends Context<ErrorContext> {
	setTokenPosition(offset: number): void;
	report(error: Error, critical: boolean): void;
	errors: ReportedError[];
	hasCriticalError: boolean;
}

declare module "./Scope" {
	interface ContextDictionary {
		[errorContextSymbol]: ErrorContext;
	}
}

export function createErrorContext(): ContextFactory<ErrorContext> {
	return function (_scope: Scope) {
		let hasCriticalError = false;
		let errors: ReportedError[] = [];
		let currentTokenOffset = 0;

		return {
			parent: undefined,
			identifier: errorContextSymbol,
			get args() {
				return undefined;
			},
			setTokenPosition(offset: number) {
				currentTokenOffset = offset;
			},
			report(error: Error, critical: boolean) {
				errors.push({
					error,
					critical,
					currentTokenOffset,
				});

				if (critical) {
					hasCriticalError = true;
				}
			},
			get errors() {
				const buffer = errors;
				errors = [];

				return buffer;
			},
			get hasCriticalError() {
				return hasCriticalError;
			},
		};
	};
}

export function readScopeErrorContext(scope: Scope): ErrorContext | undefined {
	return scope.getContextByIdentifier(errorContextSymbol);
}
