/**
 * Supported OpenAPI specifications.
 * Defaults to 3.1.0 (latest stable) while supporting 3.0.3 generation mode.
 */
export type OpenApiVersion = '3.1.0' | '3.0.3';

export interface OpenApiContact {
  readonly name?: string | undefined;
  readonly url?: string | undefined;
  readonly email?: string | undefined;
}

export interface OpenApiLicense {
  readonly name: string;
  readonly identifier?: string | undefined;
  readonly url?: string | undefined;
}

export interface OpenApiInfo {
  readonly title: string;
  readonly version: string;
  readonly description?: string | undefined;
  readonly termsOfService?: string | undefined;
  readonly contact?: OpenApiContact | undefined;
  readonly license?: OpenApiLicense | undefined;
}

export interface OpenApiServerVariable {
  readonly default: string;
  readonly description?: string | undefined;
  readonly enum?: readonly string[] | undefined;
}

export interface OpenApiServer {
  readonly url: string;
  readonly description?: string | undefined;
  readonly variables?: Record<string, OpenApiServerVariable> | undefined;
}

export type OpenApiParameterIn = 'path' | 'query' | 'header' | 'cookie';

export interface OpenApiParameter {
  readonly name: string;
  readonly in: OpenApiParameterIn;
  readonly description?: string | undefined;
  readonly required?: boolean | undefined;
  readonly deprecated?: boolean | undefined;
  readonly allowEmptyValue?: boolean | undefined;
  readonly schema?: OpenApiSchema | undefined;
  readonly example?: unknown;
  readonly examples?: Record<string, { summary?: string; value: unknown }> | undefined;
}

export interface OpenApiMediaType {
  readonly schema?: OpenApiSchema | undefined;
  readonly example?: unknown;
  readonly examples?: Record<string, { summary?: string; value: unknown }> | undefined;
}

export interface OpenApiRequestBody {
  readonly description?: string | undefined;
  readonly required?: boolean | undefined;
  readonly content: Record<string, OpenApiMediaType>;
}

export interface OpenApiHeader {
  readonly description?: string | undefined;
  readonly required?: boolean | undefined;
  readonly deprecated?: boolean | undefined;
  readonly schema?: OpenApiSchema | undefined;
}

export interface OpenApiResponse {
  readonly description: string;
  readonly headers?: Record<string, OpenApiHeader> | undefined;
  readonly content?: Record<string, OpenApiMediaType> | undefined;
}

export type OpenApiResponses = Record<string, OpenApiResponse>;

export type OpenApiSecuritySchemeType = 'apiKey' | 'http' | 'oauth2' | 'openIdConnect';

export interface OpenApiSecurityScheme {
  readonly type: OpenApiSecuritySchemeType;
  readonly description?: string | undefined;
  readonly name?: string | undefined;
  readonly in?: 'query' | 'header' | 'cookie' | undefined;
  readonly scheme?: string | undefined; // e.g. 'bearer', 'basic'
  readonly bearerFormat?: string | undefined; // e.g. 'JWT'
  readonly openIdConnectUrl?: string | undefined;
  readonly flows?: Record<string, unknown> | undefined;
}

export type OpenApiSecurityRequirement = Record<string, readonly string[]>;

export interface OpenApiTag {
  readonly name: string;
  readonly description?: string | undefined;
  readonly externalDocs?: { description?: string; url: string } | undefined;
}

export interface OpenApiSchema {
  readonly type?: string | readonly string[] | undefined;
  readonly format?: string | undefined;
  readonly title?: string | undefined;
  readonly description?: string | undefined;
  readonly default?: unknown;
  readonly multipleOf?: number | undefined;
  readonly maximum?: number | undefined;
  readonly exclusiveMaximum?: number | boolean | undefined;
  readonly minimum?: number | undefined;
  readonly exclusiveMinimum?: number | boolean | undefined;
  readonly maxLength?: number | undefined;
  readonly minLength?: number | undefined;
  readonly pattern?: string | undefined;
  readonly maxItems?: number | undefined;
  readonly minItems?: number | undefined;
  readonly uniqueItems?: boolean | undefined;
  readonly maxProperties?: number | undefined;
  readonly minProperties?: number | undefined;
  readonly required?: readonly string[] | undefined;
  readonly enum?: readonly unknown[] | undefined;
  readonly items?: OpenApiSchema | undefined;
  readonly properties?: Record<string, OpenApiSchema> | undefined;
  readonly additionalProperties?: boolean | OpenApiSchema | undefined;
  readonly nullable?: boolean | undefined;
  readonly readOnly?: boolean | undefined;
  readonly writeOnly?: boolean | undefined;
  readonly example?: unknown;
  readonly examples?: readonly unknown[] | undefined;
  readonly deprecated?: boolean | undefined;
  readonly $ref?: string | undefined;
  readonly allOf?: readonly OpenApiSchema[] | undefined;
  readonly anyOf?: readonly OpenApiSchema[] | undefined;
  readonly oneOf?: readonly OpenApiSchema[] | undefined;
  readonly not?: OpenApiSchema | undefined;
  readonly [key: `x-${string}`]: unknown;
}

export interface OpenApiOperation {
  readonly tags?: readonly string[] | undefined;
  readonly summary?: string | undefined;
  readonly description?: string | undefined;
  readonly operationId?: string | undefined;
  readonly parameters?: readonly OpenApiParameter[] | undefined;
  readonly requestBody?: OpenApiRequestBody | undefined;
  readonly responses: OpenApiResponses;
  readonly deprecated?: boolean | undefined;
  readonly security?: readonly OpenApiSecurityRequirement[] | undefined;
  readonly servers?: readonly OpenApiServer[] | undefined;
  readonly [key: `x-${string}`]: unknown;
}

export interface OpenApiPathItem {
  readonly summary?: string | undefined;
  readonly description?: string | undefined;
  readonly get?: OpenApiOperation | undefined;
  readonly put?: OpenApiOperation | undefined;
  readonly post?: OpenApiOperation | undefined;
  readonly delete?: OpenApiOperation | undefined;
  readonly options?: OpenApiOperation | undefined;
  readonly head?: OpenApiOperation | undefined;
  readonly patch?: OpenApiOperation | undefined;
  readonly trace?: OpenApiOperation | undefined;
  readonly servers?: readonly OpenApiServer[] | undefined;
  readonly parameters?: readonly OpenApiParameter[] | undefined;
}

export type OpenApiPaths = Record<string, OpenApiPathItem>;

export interface OpenApiComponents {
  readonly schemas?: Record<string, OpenApiSchema> | undefined;
  readonly responses?: Record<string, OpenApiResponse> | undefined;
  readonly parameters?: Record<string, OpenApiParameter> | undefined;
  readonly requestBodies?: Record<string, OpenApiRequestBody> | undefined;
  readonly securitySchemes?: Record<string, OpenApiSecurityScheme> | undefined;
  readonly headers?: Record<string, OpenApiHeader> | undefined;
}

export interface OpenApiDocument {
  readonly openapi: OpenApiVersion;
  readonly info: OpenApiInfo;
  readonly servers?: readonly OpenApiServer[] | undefined;
  readonly paths: OpenApiPaths;
  readonly components?: OpenApiComponents | undefined;
  readonly security?: readonly OpenApiSecurityRequirement[] | undefined;
  readonly tags?: readonly OpenApiTag[] | undefined;
  readonly externalDocs?: { description?: string; url: string } | undefined;
}

/**
 * Route metadata format for explicitly specifying OpenAPI information on routes.
 * Attached via route options: `{ metadata: { openapi: { ... } } }`.
 */
export interface OpenApiRouteMetadata {
  readonly summary?: string | undefined;
  readonly description?: string | undefined;
  readonly operationId?: string | undefined;
  readonly tags?: readonly string[] | undefined;
  readonly deprecated?: boolean | undefined;
  readonly parameters?: readonly OpenApiParameter[] | undefined;
  readonly requestBody?: OpenApiRequestBody | undefined;
  readonly responses?: OpenApiResponses | undefined;
  readonly security?: readonly OpenApiSecurityRequirement[] | undefined;
  readonly hidden?: boolean | undefined;
  readonly excludeFromOpenApi?: boolean | undefined;
  readonly [key: `x-${string}`]: unknown;
}
