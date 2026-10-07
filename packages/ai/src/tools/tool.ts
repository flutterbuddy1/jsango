import type { ToolContext, ToolDefinition } from '../types.js';

export interface CreateToolOptions<TInput = any, TOutput = any> {
  name: string;
  description: string;
  input?: any | undefined;
  schema?: any | undefined;
  parameters?: any | undefined;
  inputSchema?: any | undefined;
  execute: (input: TInput, ctx: ToolContext) => Promise<TOutput> | TOutput;
  requiresApproval?: boolean | undefined;
  permissions?: string[] | undefined;
  timeoutMs?: number | undefined;
  maxRetries?: number | undefined;
}

export function tool<TInput = any, TOutput = any>(
  optionsOrName: CreateToolOptions<TInput, TOutput> | string,
  description?: string,
  execute?: (input: TInput, ctx: ToolContext) => Promise<TOutput> | TOutput
): ToolDefinition<TInput, TOutput> {
  if (typeof optionsOrName === 'string') {
    if (!description || !execute) {
      throw new Error("tool(name, description, execute) requires 3 arguments.");
    }
    const inferred = inferParametersFromFunction(execute);
    return {
      name: optionsOrName,
      description,
      inputSchema: inferred ?? { type: 'object', properties: {} },
      execute,
    };
  }

  const rawSchemaDef =
    optionsOrName.parameters ??
    optionsOrName.inputSchema ??
    optionsOrName.schema ??
    optionsOrName.input;

  let inputSchema = rawSchemaDef ? toJsonSchema(rawSchemaDef) : null;
  if (!inputSchema || !inputSchema.properties || Object.keys(inputSchema.properties).length === 0) {
    const inferred = inferParametersFromFunction(optionsOrName.execute);
    if (inferred) {
      inputSchema = inferred;
    } else {
      inputSchema = inputSchema ?? { type: 'object', properties: {} };
    }
  }

  return {
    name: optionsOrName.name,
    description: optionsOrName.description,
    inputSchema,
    execute: optionsOrName.execute,
    requiresApproval: optionsOrName.requiresApproval,
    permissions: optionsOrName.permissions,
    timeoutMs: optionsOrName.timeoutMs,
    maxRetries: optionsOrName.maxRetries,
  };
}

/**
 * Automatically infers parameter names and types from function signature
 */
function inferParametersFromFunction(fn: Function): Record<string, unknown> | null {
  try {
    const fnStr = fn.toString().replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '').trim();
    const match = fnStr.match(/^(?:async\s*)?(?:function[^(]*)?\s*\(\s*\{([^}]+)\}/);
    if (match && match[1]) {
      const paramNames = match[1]
        .split(',')
        .map((p) => p.trim().split(/[:=]/)[0]?.trim())
        .filter((p): p is string => Boolean(p && !p.startsWith('...') && /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(p)));

      if (paramNames.length > 0) {
        const properties: Record<string, unknown> = {};
        for (const name of paramNames) {
          const isNum = /(price|percent|amount|count|qty|quantity|num|id|rate|discount)/i.test(name);
          const isBool = /(is|has|should|allow|can)/i.test(name);
          properties[name] = {
            type: isNum ? 'number' : isBool ? 'boolean' : 'string',
            description: `Parameter '${name}'`,
          };
        }
        return {
          type: 'object',
          properties,
          required: paramNames,
        };
      }
    }
  } catch {
    // Ignore inspection failure
  }
  return null;
}

/**
 * Converts JSango validation schema objects or standard objects into JSON Schema format
 */
export function toJsonSchema(schemaDef: any): Record<string, unknown> {
  if (!schemaDef) {
    return { type: 'object', properties: {} };
  }

  // If already a JSON schema
  if (schemaDef.type && (schemaDef.properties || schemaDef.items)) {
    return schemaDef;
  }

  // If JSango Validation Schema instance with toJsonSchema method
  if (typeof schemaDef.toJsonSchema === 'function') {
    return schemaDef.toJsonSchema();
  }

  // If JSango ObjectSchema or raw validator shape
  const shape = schemaDef.shape ?? schemaDef;
  if (!shape || typeof shape !== 'object') {
    return { type: 'object', properties: {} };
  }

  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [key, val] of Object.entries(shape)) {
    if (val && typeof val === 'object') {
      const typeName = (val as any).constructor?.name ?? '';
      const customType = (val as any).type ?? '';

      if (
        typeName === 'StringSchema' ||
        typeName === 'StringValidator' ||
        customType === 'string'
      ) {
        properties[key] = { type: 'string', description: `Parameter '${key}'` };
      } else if (
        typeName === 'NumberSchema' ||
        typeName === 'NumberValidator' ||
        customType === 'number'
      ) {
        properties[key] = { type: 'number', description: `Parameter '${key}'` };
      } else if (
        typeName === 'BooleanSchema' ||
        typeName === 'BooleanValidator' ||
        customType === 'boolean'
      ) {
        properties[key] = { type: 'boolean', description: `Parameter '${key}'` };
      } else if (typeName === 'ArraySchema' || customType === 'array') {
        properties[key] = { type: 'array', items: { type: 'string' } };
      } else if (typeof (val as any).type === 'string') {
        properties[key] = { type: (val as any).type, description: (val as any).description ?? `Parameter '${key}'` };
      } else {
        properties[key] = { type: 'string', description: `Parameter '${key}'` };
      }

      if (!(val as any).isOptional) {
        required.push(key);
      }
    } else if (typeof val === 'string') {
      properties[key] = { type: val, description: `Parameter '${key}'` };
      required.push(key);
    } else {
      properties[key] = { type: 'string', description: `Parameter '${key}'` };
      required.push(key);
    }
  }

  return {
    type: 'object',
    properties,
    required: required.length > 0 ? required : undefined,
  };
}
