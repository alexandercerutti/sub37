/// <reference types="chai">
import { Tokenizer } from "../lib/Tokenizer.js";

describe("Tokenizer", () => {
	describe("[static]", () => {
		describe("parseHTMLEntity", () => {
			it("empty string should return current cursor", () => {
				chai.expect(Tokenizer.parseHTMLEntity("", 5)).to.eql(["", 5]);
			});
		});
	});

	xdescribe("[instance]", () => {});
});
