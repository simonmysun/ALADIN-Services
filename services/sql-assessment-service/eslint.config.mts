import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";

export default defineConfig([
	{
		files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
		plugins: { js },
		extends: ["js/recommended"],
		languageOptions: { globals: globals.browser },
		ignores: ["./test", "./build", "./coverage", "./node_modules"],
	},
	tseslint.configs.recommended,
	{
		rules: {
			"@typescript-eslint/no-unused-vars": [
				"error",
				{
					// Allow unused variables like `_schema`
					varsIgnorePattern: "^_",
					// Allow unused function args like `(_req, res)`
					argsIgnorePattern: "^_",
				},
			],
			// TODO: enforce the below rules again and clean up the code accordingly
			"@typescript-eslint/no-explicit-any": "off",
			"preserve-caught-error": "off",
		},
	},
]);
