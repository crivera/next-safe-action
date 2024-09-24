/* eslint-disable @typescript-eslint/no-unused-vars */
import { z } from "zod";

export const acceptsRequestBody = (method: string) => {
	if (method === "GET" || method === "DELETE") {
		return false;
	}
	return true;
};

export const normalizePath = (path: string) => {
	return `/${path.replace(/^\/|\/$/g, "")}`;
};

export const getPathParameters = (path: string) => {
	return Array.from(path.matchAll(/\{(.+?)\}/g)).map(([_, key]) => key!);
};

export const preparePathForMatching = (path: string) => {
	return path.replace(/\{/g, ":").replace(/\}/g, "");
};

export const getPathRegExp = (path: string) => {
	const groupedExp = path.replace(/\{(.+?)\}/g, (_, key: string) => `(?<${key}>[^/]+)`);
	return new RegExp(`^${groupedExp}$`, "i");
};

const FORM_DATA_CONTENT_TYPE = "application/x-www-form-urlencoded";
const MULTI_PART_CONTENT_TYPE = "multipart/form-data";
const JSON_CONTENT_TYPE = "application/json";
const TEXT_PLAIN = "text/plain";

export type OpenApiContentType =
	| typeof FORM_DATA_CONTENT_TYPE
	| typeof JSON_CONTENT_TYPE
	| typeof MULTI_PART_CONTENT_TYPE
	| typeof TEXT_PLAIN
	| (string & {});

export const instanceofZodTypeObject = (type: z.ZodTypeAny): type is z.ZodObject<z.ZodRawShape> => {
	return instanceofZodTypeKind(type, z.ZodFirstPartyTypeKind.ZodObject);
};

export const instanceofZodTypeKind = <Z extends z.ZodFirstPartyTypeKind>(
	type: z.ZodTypeAny,
	zodTypeKind: Z
): type is InstanceType<(typeof z)[Z]> => {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
	return type?._def?.typeName === zodTypeKind;
};

export const unwrapZodType = (type: z.ZodTypeAny, unwrapPreprocess: boolean): z.ZodTypeAny => {
	if (instanceofZodTypeKind(type, z.ZodFirstPartyTypeKind.ZodOptional)) {
		return unwrapZodType(type.unwrap(), unwrapPreprocess);
	}
	if (instanceofZodTypeKind(type, z.ZodFirstPartyTypeKind.ZodDefault)) {
		return unwrapZodType(type.removeDefault(), unwrapPreprocess);
	}
	if (instanceofZodTypeKind(type, z.ZodFirstPartyTypeKind.ZodLazy)) {
		return unwrapZodType(type._def.getter(), unwrapPreprocess);
	}
	if (instanceofZodTypeKind(type, z.ZodFirstPartyTypeKind.ZodEffects)) {
		if (type._def.effect.type === "refinement") {
			return unwrapZodType(type._def.schema, unwrapPreprocess);
		}
		if (type._def.effect.type === "transform") {
			return unwrapZodType(type._def.schema, unwrapPreprocess);
		}
		if (unwrapPreprocess && type._def.effect.type === "preprocess") {
			return unwrapZodType(type._def.schema, unwrapPreprocess);
		}
	}

	return type;
};

export type ZodTypeLikeVoid = z.ZodVoid | z.ZodUndefined | z.ZodNever;

export const instanceofZodTypeLikeVoid = (type: z.ZodTypeAny): type is ZodTypeLikeVoid => {
	return (
		instanceofZodTypeKind(type, z.ZodFirstPartyTypeKind.ZodVoid) ||
		instanceofZodTypeKind(type, z.ZodFirstPartyTypeKind.ZodUndefined) ||
		instanceofZodTypeKind(type, z.ZodFirstPartyTypeKind.ZodNever)
	);
};

type NativeEnumType = {
	[k: string]: string | number;
	[nu: number]: string;
};

export type ZodTypeLikeString =
	| z.ZodString
	| z.ZodOptional<ZodTypeLikeString>
	| z.ZodDefault<ZodTypeLikeString>
	| z.ZodEffects<ZodTypeLikeString, unknown, unknown>
	| z.ZodUnion<[ZodTypeLikeString, ...ZodTypeLikeString[]]>
	| z.ZodIntersection<ZodTypeLikeString, ZodTypeLikeString>
	| z.ZodLazy<ZodTypeLikeString>
	| z.ZodLiteral<string>
	| z.ZodEnum<[string, ...string[]]>
	| z.ZodNativeEnum<NativeEnumType>;

export const instanceofZodTypeLikeString = (_type: z.ZodTypeAny): _type is ZodTypeLikeString => {
	const type = unwrapZodType(_type, false);

	if (instanceofZodTypeKind(type, z.ZodFirstPartyTypeKind.ZodEffects)) {
		if (type._def.effect.type === "preprocess") {
			return true;
		}
	}
	if (instanceofZodTypeKind(type, z.ZodFirstPartyTypeKind.ZodUnion)) {
		return !type._def.options.some((option) => !instanceofZodTypeLikeString(option));
	}
	if (instanceofZodTypeKind(type, z.ZodFirstPartyTypeKind.ZodIntersection)) {
		return instanceofZodTypeLikeString(type._def.left) && instanceofZodTypeLikeString(type._def.right);
	}
	if (instanceofZodTypeKind(type, z.ZodFirstPartyTypeKind.ZodLiteral)) {
		return typeof type._def.value === "string";
	}
	if (instanceofZodTypeKind(type, z.ZodFirstPartyTypeKind.ZodEnum)) {
		return true;
	}
	if (instanceofZodTypeKind(type, z.ZodFirstPartyTypeKind.ZodNativeEnum)) {
		return !Object.values(type._def.values).some((value) => typeof value === "number");
	}
	return instanceofZodTypeKind(type, z.ZodFirstPartyTypeKind.ZodString);
};

export const zodSupportsCoerce = "coerce" in z;

export type ZodTypeCoercible = z.ZodNumber | z.ZodBoolean | z.ZodBigInt | z.ZodDate;

export const instanceofZodTypeCoercible = (_type: z.ZodTypeAny): _type is ZodTypeCoercible => {
	const type = unwrapZodType(_type, false);
	return (
		instanceofZodTypeKind(type, z.ZodFirstPartyTypeKind.ZodNumber) ||
		instanceofZodTypeKind(type, z.ZodFirstPartyTypeKind.ZodBoolean) ||
		instanceofZodTypeKind(type, z.ZodFirstPartyTypeKind.ZodBigInt) ||
		instanceofZodTypeKind(type, z.ZodFirstPartyTypeKind.ZodDate)
	);
};

export const instanceofZodTypeOptional = (type: z.ZodTypeAny): type is z.ZodOptional<z.ZodTypeAny> => {
	return instanceofZodTypeKind(type, z.ZodFirstPartyTypeKind.ZodOptional);
};
