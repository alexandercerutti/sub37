import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
	plugins: [
		tsconfigPaths({
			root: "../..",
			loose: true,
		}),
	],
	server: {
		host: "0.0.0.0",
		port: 3000,
		strictPort: true,
	},
});
