/*
 * jsdom (used as jest testEnvironment) ships a partial Performance implementation
 * that omits clearMarks, clearMeasures, mark and measure.
 * Polyfill only the methods that are missing so the rest of the API is unaffected.
 */
for (const method of ["clearMarks", "clearMeasures", "mark", "measure"]) {
	if (typeof performance[method] !== "function") {
		performance[method] = () => {};
	}
}
