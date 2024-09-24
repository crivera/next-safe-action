/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import type { OpenAPIV3 } from "openapi-types";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";
import type { createOpenApiServerActionRouter } from "./router";
import type { OpenApiContentType } from "./utils";
import {
	getPathParameters,
	instanceofZodTypeCoercible,
	instanceofZodTypeLikeString,
	instanceofZodTypeLikeVoid,
	instanceofZodTypeObject,
	instanceofZodTypeOptional,
	unwrapZodType,
	zodSupportsCoerce,
} from "./utils";

// Constants
const securitySchemes = {
	Authorization: {
		type: "http",
		scheme: "bearer",
	},
};

// Helper functions
const zodSchemaToOpenApiSchemaObject = (zodSchema: z.ZodType): OpenAPIV3.SchemaObject => {
	return zodToJsonSchema(zodSchema, {
		target: "openApi3",
		$refStrategy: "none",
	}) as OpenAPIV3.SchemaObject;
};

const instanceofZodType = (type: any): type is z.ZodTypeAny => {
	return !!type?._def?.typeName;
};

type OpenApiInfo = {
	title: string;
	description: string;
	version: string;
	urls: string[];
};

// Main function
export async function generateOpenApiInfo(
	router: ReturnType<typeof createOpenApiServerActionRouter>,
	{ title, description, version, urls }: OpenApiInfo
) {
	const routes = router.getRoutes();
	const paths: Record<string, any> = {};

	for (const route in routes) {
		const routeConfig = routes[route];
		if (!routeConfig) continue;

		paths[route] = {};

		// Handle GET, POST, PUT, DELETE methods
		const methods = ["GET", "POST", "PUT", "DELETE"] as const;
		for (const method of methods) {
			if (routeConfig[method]) {
				paths[route][method.toLowerCase()] = await generateMethodSpec(method, route, routeConfig[method]);
			}
		}
	}

	return {
		openapi: "3.0.1",
		info: {
			title,
			version,
			description,
		},
		servers: urls.map((url) => ({ url })),
		components: {
			securitySchemes,
			responses: { error: errorResponseObject },
		},
		paths,
	};
}

// Helper functions for generating method specifications
async function generateMethodSpec(method: "GET" | "POST" | "PUT" | "DELETE", route: string, config: any) {
	const schemas = await config.client.schemas();
	const pathParams = getPathParameters(route);

	const baseSpec = {
		operationId: route.replace(/\./g, "-"),
		summary: schemas.metadata?.name || "Name Metadata missing",
		description: schemas.metadata?.description || "Description Metadata missing",
		security: Object.keys(securitySchemes).map((name) => ({ [name]: [] })),
		tags: schemas.metadata?.tags || [],
		responses: getResponsesObject(schemas.outputSchema),
	};

	if (method === "GET") {
		return {
			...baseSpec,
			parameters: getParameterObjects(schemas.inputSchema, pathParams, "all"),
		};
	} else if (method === "POST" || method === "PUT") {
		return {
			...baseSpec,
			requestBody: getRequestBodyObject(schemas.inputSchema, pathParams, ["application/json"]),
			parameters:
				method === "POST"
					? [
							{
								name: "a",
								in: "path",
								required: true,
								schema: zodSchemaToOpenApiSchemaObject(z.string()),
								description: "test",
								example: "test",
							},
						]
					: undefined,
		};
	} else {
		return baseSpec;
	}
}

const errorResponseObject: OpenAPIV3.ResponseObject = {
	description: "Error response",
	content: {
		"application/json": {
			schema: zodSchemaToOpenApiSchemaObject(
				z.object({
					message: z.string(),
					code: z.string(),
				})
			),
		},
	},
};

const getRequestBodyObject = (
	schema: unknown,
	pathParameters: string[],
	contentTypes: OpenApiContentType[]
): OpenAPIV3.RequestBodyObject | undefined => {
	if (!instanceofZodType(schema)) {
		throw new Error("Input parser expects a Zod validator (request body)");
	}

	const isRequired = !schema.isOptional();
	const unwrappedSchema = unwrapZodType(schema, true);

	if (pathParameters.length === 0 && instanceofZodTypeLikeVoid(unwrappedSchema)) {
		return undefined;
	}

	// if all keys are path parameters
	if (pathParameters.length > 0 && Object.keys(unwrappedSchema).length === 0) {
		return undefined;
	}

	// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
	const openApiSchemaObject = zodSchemaToOpenApiSchemaObject(unwrappedSchema);
	const content: OpenAPIV3.RequestBodyObject["content"] = {};
	for (const contentType of contentTypes) {
		content[contentType] = {
			schema: openApiSchemaObject,
		};
	}

	return {
		required: isRequired,
		content,
	};
};

const getResponsesObject = (
	schema: unknown,
	example?: Record<string, any>,
	headers?: Record<string, OpenAPIV3.HeaderObject | OpenAPIV3.ReferenceObject>
): OpenAPIV3.ResponsesObject => {
	if (schema !== undefined && !instanceofZodType(schema)) {
		throw new Error("Output parser must be a ZodObject");
	}

	const successResponseObject: OpenAPIV3.ResponseObject = {
		description: "Successful response",
		headers: headers,
		content: {
			"application/json": {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
				schema: zodSchemaToOpenApiSchemaObject(schema || z.unknown()),
				example,
			},
		},
	};

	return {
		200: successResponseObject,
		500: {
			$ref: "#/components/responses/error",
		},
	};
};

const getParameterObjects = (
	schema: unknown,
	pathParameters: string[],
	inType: "all" | "path" | "query"
): OpenAPIV3.ParameterObject[] | undefined => {
	if (!instanceofZodType(schema)) {
		throw new Error("Input parser expects a Zod validator");
	}

	const isRequired = !schema.isOptional();
	const unwrappedSchema = unwrapZodType(schema, true);

	if (pathParameters.length === 0 && instanceofZodTypeLikeVoid(unwrappedSchema)) {
		return undefined;
	}

	if (!instanceofZodTypeObject(unwrappedSchema)) {
		throw new Error("Input parser must be a ZodObject");
	}

	const shape = unwrappedSchema.shape;
	const shapeKeys = Object.keys(shape);

	for (const pathParameter of pathParameters) {
		if (!shapeKeys.includes(pathParameter)) {
			throw new Error(`Input parser expects key from path: "${pathParameter}"`);
		}
	}

	return shapeKeys
		.filter((shapeKey) => {
			const isPathParameter = pathParameters.includes(shapeKey);
			if (inType === "path") {
				return isPathParameter;
			} else if (inType === "query") {
				return !isPathParameter;
			}
			return true;
		})
		.map((shapeKey) => {
			let shapeSchema = shape[shapeKey]!;
			const isShapeRequired = !shapeSchema.isOptional();
			const isPathParameter = pathParameters.includes(shapeKey);

			if (!instanceofZodTypeLikeString(shapeSchema)) {
				if (zodSupportsCoerce) {
					if (!instanceofZodTypeCoercible(shapeSchema)) {
						throw new Error(`Input parser key: "${shapeKey}" must be ZodString`);
					}
				} else {
					throw new Error(`Input parser key: "${shapeKey}" must be ZodString`);
				}
			}

			if (instanceofZodTypeOptional(shapeSchema)) {
				if (isPathParameter) {
					throw new Error(`Path parameter: "${shapeKey}" must not be optional`);
				}
				shapeSchema = shapeSchema.unwrap();
			}

			// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
			const { description, ...openApiSchemaObject } = zodSchemaToOpenApiSchemaObject(shapeSchema);

			return {
				name: shapeKey,
				in: isPathParameter ? "path" : "query",
				required: isPathParameter || (isRequired && isShapeRequired),
				schema: openApiSchemaObject,
				description: description,
				// example: example?.[shapeKey]
			};
		});
};
