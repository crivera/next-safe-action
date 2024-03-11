import type { ValidationIssue } from "@typeschema/core";
import type { Schema } from "@typeschema/main";
import type { ValidationErrors } from ".";

export const isError = (error: unknown): error is Error => error instanceof Error;

// UTIL TYPES

// Returns type or promise of type.
export type MaybePromise<T> = Promise<T> | T;

// Extends an object without printing "&".
export type Extend<S> = S extends infer U ? { [K in keyof U]: U[K] } : never;

// VALIDATION ERRORS

// Object with an optional list of validation errors.
export type ErrorList = { _errors?: string[] } & {};

// Creates nested schema validation errors type using recursion.
export type SchemaErrors<S> = {
	[K in keyof S]?: S[K] extends object | null | undefined
		? Extend<ErrorList & SchemaErrors<S[K]>>
		: ErrorList;
} & {};

// This function is used to build the validation errors object from a list of validation issues.
export const buildValidationErrors = <const S extends Schema>(issues: ValidationIssue[]) => {
	const ve: any = {};

	for (const issue of issues) {
		const { path, message } = issue;

		// When path is undefined or empty, set root errors.
		if (!path || path.length === 0) {
			ve._errors = ve._errors ? [...ve._errors, message] : [message];
			continue;
		}

		// Reference to errors object.
		let ref = ve;

		// Set object for the path, if it doesn't exist.
		for (let i = 0; i < path.length - 1; i++) {
			const k = path[i]!;

			if (!ref[k]) {
				ref[k] = {};
			}

			ref = ref[k];
		}

		// Key is always the last element of the path.
		const key = path[path.length - 1]!;

		// Set error for the current path. If `_errors` array exists, add the message to it.
		ref[key] = (
			ref[key]?._errors
				? { ...structuredClone(ref[key]), _errors: [...ref[key]._errors, message] }
				: { ...structuredClone(ref[key]), _errors: [message] }
		) satisfies ErrorList;
	}

	return ve as ValidationErrors<S>;
};
