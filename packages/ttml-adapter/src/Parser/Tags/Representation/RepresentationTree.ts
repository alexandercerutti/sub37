import { createNode, withSelfReference } from "./NodeRepresentation.js";
import * as Kleene from "./kleene.js";

/**
 * This is a tree representing how elements are allowed to be disposed in a
 * parent-child relationship, according to each element, starting from the
 * tt element. A 'null' element is the first one as we might not find
 * a tt.
 */

export const RepresentationTree = createNode(null, () => [
	createNode("tt", () => [
		Kleene.zeroOrOne(
			createNode("head", () => [
				Kleene.zeroOrOne(
					createNode("styling", () => [
						Kleene.zeroOrMore(
							//
							createNode("initial"),
						),
						Kleene.zeroOrMore(
							//
							createNode("style"),
						),
					]),
				),
				Kleene.zeroOrOne(
					createNode("layout", () => [
						//
						Kleene.zeroOrMore(LayoutClass()),
					]),
				),
				Kleene.zeroOrOne(
					createNode("animation", () => [
						//
						Kleene.zeroOrMore(AnimationClass()),
					]),
				),
			]),
		),
		Kleene.zeroOrOne(
			createNode("body", () => [
				Kleene.zeroOrMore(AnimationClass()),
				Kleene.zeroOrMore(
					withSelfReference(
						createNode("div", () => [
							Kleene.zeroOrMore(AnimationClass()),
							Kleene.zeroOrOne(LayoutClass()),
							Kleene.zeroOrMore(
								createNode("p", () => [
									Kleene.zeroOrMore(AnimationClass()),
									Kleene.zeroOrOne(LayoutClass()),
									Kleene.zeroOrMore(
										Kleene.or(
											withSelfReference(
												//
												createNode("span", () => [
													//
													Kleene.zeroOrMore(AnimationClass()),
												]),
											),
											withSelfReference(
												//
												createNode("br"),
											),
										),
									),
								]),
							),
						]),
					),
				),
			]),
		),
	]),
]);

/**
 * Layout.class
 * @see https://w3c.github.io/ttml2/#element-vocab-group-block
 */
function LayoutClass() {
	return createNode("region", () => [
		Kleene.zeroOrMore(AnimationClass()),
		//
		Kleene.zeroOrMore(
			//
			createNode("style"),
		),
	]);
}

/**
 * Animation.class
 * @see https://w3c.github.io/ttml2/#element-vocab-group-block
 */
function AnimationClass() {
	return Kleene.or(
		//
		createNode("animate"),
		createNode("set"),
	);
}
