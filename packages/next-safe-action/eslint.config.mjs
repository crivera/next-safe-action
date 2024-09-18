import { fixupPluginRules } from "@eslint/compat";
import { FlatCompat } from "@eslint/eslintrc";
import js from "@eslint/js";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import reactHooks from "eslint-plugin-react-hooks";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
	baseDirectory: __dirname,
	recommendedConfig: js.configs.recommended,
	allConfig: js.configs.all,
});

export default [
	{
		ignores: ["**/*.js", "**/*.mjs", "**/*.cjs", "dist/**/*"],
	},
	...compat.extends("eslint:recommended", "plugin:@typescript-eslint/recommended-type-checked", "prettier"),
	{
		plugins: {
			"@typescript-eslint": typescriptEslint,
			"react-hooks": fixupPluginRules(reactHooks),
		},

		languageOptions: {
			parser: tsParser,
			ecmaVersion: 5,
			sourceType: "script",

			parserOptions: {
				project: "./tsconfig.json",
				tsconfigRootDir: ".",
			},
		},

		rules: {
			"@typescript-eslint/consistent-type-imports": "error",
			"@typescript-eslint/consistent-type-exports": "error",
			"@typescript-eslint/unbound-method": "off",
			"@typescript-eslint/ban-ts-comment": "off",
			"@typescript-eslint/no-redundant-type-constituents": "off",
			"@typescript-eslint/no-explicit-any": "off",
			"@typescript-eslint/ban-types": "off",
			"react-hooks/exhaustive-deps": "warn",
			"@typescript-eslint/require-await": "off",
		},
	},
];
