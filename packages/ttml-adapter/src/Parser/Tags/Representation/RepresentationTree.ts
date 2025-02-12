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
						Kleene.zeroOrMore(
							createNode("region", () => [
								//
								Kleene.zeroOrMore(
									//
									createNode("style"),
								),
							]),
						),
					]),
				),
			]),
		),
		Kleene.zeroOrOne(
			createNode("body", () => [
				Kleene.zeroOrMore(
					withSelfReference(
						createNode("div", () => [
							Kleene.zeroOrOne(
								createNode("region", () => [
									//
									Kleene.zeroOrMore(
										//
										createNode("style"),
									),
								]),
							),
							Kleene.zeroOrMore(
								createNode("p", () => [
									Kleene.zeroOrOne(
										createNode("region", () => [
											//
											Kleene.zeroOrMore(
												//
												createNode("style"),
											),
										]),
									),
									Kleene.zeroOrMore(
										Kleene.or(
											withSelfReference(
												//
												createNode("span"),
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
