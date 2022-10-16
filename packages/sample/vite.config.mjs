// @ts-check

import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import checker from "vite-plugin-checker";

/**
 * This file was a .ts file but vite-plugin-checker somehow
 * checks also for what there's in this file and prints out
 * errors
 */

export default defineConfig({
	plugins: [
		tsconfigPaths({
			loose: true,
			root: "../..",
		}),
		checker({
			typescript: {
				root: "../..",
			},
		}),
	],
	server: {
		host: "0.0.0.0",
		port: 3000,
		strictPort: true,
	},
	assetsInclude: ["**/*.vtt"],
});
