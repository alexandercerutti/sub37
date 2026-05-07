import type { Context, ContextFactory, Scope } from "./Scope.js";

const errorContextSymbol = Symbol("error");

interface ErrorReporters {
	onReport(error: Error, critical: boolean, offset: number): void;
}

interface ErrorContext extends Context<ErrorContext, ErrorReporters> {
	setTokenPosition(offset: number): void;
	report(error: Error, critical: boolean): void;
	hasCriticalError: boolean;
}

declare module "./Scope" {
	interface ContextDictionary {
		[errorContextSymbol]: ErrorContext;
	}
}

export function createErrorContext(args: ErrorReporters): ContextFactory<ErrorContext> {
	return function (_scope: Scope) {
		let hasCriticalError = false;
		let currentTokenOffset = 0;

		return {
			parent: undefined,
			identifier: errorContextSymbol,
			get args() {
				return args;
			},
			setTokenPosition(offset: number) {
				currentTokenOffset = offset;
			},
			report(error: Error, critical: boolean) {
				args.onReport(error, critical, currentTokenOffset);

				if (critical) {
					hasCriticalError = true;
				}
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
