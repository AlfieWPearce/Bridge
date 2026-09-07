/** @format */

import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import { defineConfig } from "eslint/config";
import globals from "globals";

export default defineConfig([
	js.configs.recommended,
	prettier,
	{
		files: ["**/*.{js,mjs,cjs}"],
		plugins: { js },
		extends: ["js/recommended"],
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node,
				...globals.p5,
			},
		},
		rules: {
			"no-unused-vars": "warn",
			"no-undef": "off",
		},
	},
]);
