import type { Context, ContextFactory, Scope } from "./Scope.js";
import { onAttachedSymbol, onMergeSymbol } from "./Scope.js";
import type { Animation, CalcMode } from "../Animations/parseAnimation.js";
import { createAnimationParser } from "../Animations/parseAnimation.js";

const animationContextSymbol = Symbol("animations");
const animationParserGetterSymbol = Symbol("animation.parser");

type AnimationParser = ReturnType<typeof createAnimationParser>;

export interface AnimationContainerContextState {
	calcMode: string | undefined;
	attributes: Record<string, string>;
}

interface AnimationContainerContext extends Context<
	AnimationContainerContext,
	AnimationContainerContextState[]
> {
	getAnimationById(id: string | undefined): Animation<CalcMode> | undefined;
}

declare module "./Scope" {
	interface ContextDictionary {
		[animationContextSymbol]: AnimationContainerContext;
	}
}

export function createAnimationContainerContext(
	contextState: AnimationContainerContextState[],
): ContextFactory<AnimationContainerContext> {
	return function (scope: Scope) {
		if (!contextState.length) {
			return null;
		}

		const animationParser: AnimationParser = createAnimationParser(scope);

		return {
			parent: undefined,
			identifier: animationContextSymbol,
			get args() {
				return contextState;
			},
			[onAttachedSymbol](): void {
				for (const { calcMode = "linear", attributes } of contextState) {
					animationParser.process(calcMode as CalcMode, attributes);
				}
			},
			[onMergeSymbol](incomingContext: AnimationContainerContext): void {
				const { args } = incomingContext;

				for (const { calcMode = "linear", attributes } of args) {
					animationParser.process(calcMode as CalcMode, attributes);
				}
			},
			get [animationParserGetterSymbol]() {
				return animationParser;
			},
			getAnimationById(id: string | undefined): Animation<CalcMode> | undefined {
				if (!id?.length) {
					return undefined;
				}

				return animationParser.get(id);
			},
			get animations(): Animation<CalcMode>[] {
				return Object.values(animationParser.getAll());
			},
		};
	};
}

export function readScopeAnimationContext(scope: Scope): AnimationContainerContext | undefined {
	return scope.getContextByIdentifier(animationContextSymbol);
}
