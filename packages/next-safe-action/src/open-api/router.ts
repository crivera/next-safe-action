/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-function-type */
import { NextResponse } from "next/server";
import type { SafeActionResult } from "..";

type RouteConfig = {
	handler: Function;
	client: any;
};

type RouteMethod = "GET" | "POST" | "PUT" | "DELETE";

type Routes = {
	[path: string]: {
		[method in RouteMethod]?: RouteConfig;
	};
};

function matchRoute(pathname: string, routePath: string) {
	const pathParts = pathname.split("/");
	const routeParts = routePath.split("/");

	if (pathParts.length !== routeParts.length) return false;

	const pathParams: Record<string, string> = {};
	for (let i = 0; i < routeParts.length; i++) {
		const routePart = routeParts[i];
		const pathPart = pathParts[i];

		if (routePart?.startsWith("{") && routePart.endsWith("}")) {
			// Dynamic segment (e.g., '{postId}')
			const paramName = routePart.slice(1, -1); // Get the name inside the brackets
			if (pathPart) {
				pathParams[paramName] = pathPart;
			}
		} else if (routePart !== pathPart) {
			// If the static parts don't match, it's not the right route
			return false;
		}
	}

	return pathParams;
}

export const createOpenApiServerActionRouter = ({ pathPrefix = "" }) => {
	const routes: Routes = {};

	const router = {
		get(path: string, handler: Function, client: any) {
			routes[pathPrefix + path] = {
				...routes[pathPrefix + path],
				GET: { handler, client },
			};
			return router;
		},
		post(path: string, handler: Function, client: any) {
			routes[pathPrefix + path] = {
				...routes[pathPrefix + path],
				POST: { handler, client },
			};
			return router;
		},
		put(path: string, handler: Function, client: any) {
			routes[pathPrefix + path] = {
				...routes[pathPrefix + path],
				PUT: { handler, client },
			};
			return router;
		},
		delete(path: string, handler: Function, client: any) {
			routes[pathPrefix + path] = {
				...routes[pathPrefix + path],
				DELETE: { handler, client },
			};
			return router;
		},
		getRoutes() {
			return routes;
		},
	};

	return router;
};

function handleResult(result: SafeActionResult<any, undefined, []>) {
	if (result.data) {
		return NextResponse.json(result.data, { status: 200 });
	}

	if (result.serverError) {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		const code = typeof result.serverError === "object" ? result.serverError?.code || 500 : 500;

		const responseBody = typeof result.serverError === "object" ? result.serverError : { message: result.serverError };

		return NextResponse.json(responseBody, { status: code });
	}

	return NextResponse.json({ message: "Unknown error" }, { status: 500 });
}

export function createRouteHandlers(router: ReturnType<typeof createOpenApiServerActionRouter>) {
	const routes = router.getRoutes();

	const findRoute = (pathname: string, method: RouteMethod) => {
		for (const routePath in routes) {
			const pathParams = matchRoute(pathname, routePath);
			if (pathParams && routes[routePath]?.[method]) {
				return { handler: routes[routePath][method].handler, pathParams };
			}
		}
		return null;
	};

	return {
		async GET(req: Request) {
			const url = new URL(req.url);
			const route = findRoute(url.pathname, "GET");
			if (route) {
				const queryParams = Object.fromEntries(url.searchParams.entries());

				const result = (await route.handler({
					...route.pathParams,
					...queryParams,
				})) as SafeActionResult<any, undefined, []>;

				return handleResult(result);
			}

			return NextResponse.json({ message: "Route not found" }, { status: 404 });
		},
		async POST(req: Request) {
			const url = new URL(req.url);

			const route = findRoute(url.pathname, "POST");
			if (route) {
				const queryParams = Object.fromEntries(url.searchParams.entries());
				const body = (await req.json()) as Record<string, unknown>;

				const result = (await route.handler({
					...route.pathParams,
					...queryParams,
					...body,
				})) as SafeActionResult<any, undefined, []>;

				return handleResult(result);
			}

			return NextResponse.json({ message: "Route not found" }, { status: 404 });
		},
		async PUT(req: Request) {
			const url = new URL(req.url);
			const route = findRoute(url.pathname, "PUT");

			if (route) {
				const queryParams = Object.fromEntries(url.searchParams.entries());
				const body = (await req.json()) as Record<string, unknown>;

				const result = (await route.handler({
					...route.pathParams,
					...queryParams,
					...body,
				})) as SafeActionResult<any, undefined, []>;

				return handleResult(result);
			}

			return NextResponse.json({ message: "Route not found" }, { status: 404 });
		},
		async DELETE(req: Request) {
			const url = new URL(req.url);
			const route = findRoute(url.pathname, "DELETE");

			if (route) {
				const queryParams = Object.fromEntries(url.searchParams.entries());
				const result = (await route.handler({
					...route.pathParams,
					...queryParams,
				})) as SafeActionResult<any, undefined, []>;

				return handleResult(result);
			}

			return NextResponse.json({ message: "Route not found" }, { status: 404 });
		},
	};
}
