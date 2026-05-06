import type { Context, ContextFactory, Scope } from "./Scope.js";

const errorContextSymbol = Symbol("error");

interface ErrorReporters {
	onReport(error: Error, critical: boolean): void;
}

interface ErrorContext extends Context<ErrorContext, ErrorReporters> {
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

		return {
			parent: undefined,
			identifier: errorContextSymbol,
			get args() {
				return args;
			},
			report(error: Error, critical: boolean) {
				args.onReport(error, critical);

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
