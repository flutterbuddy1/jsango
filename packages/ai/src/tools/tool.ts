import type { ToolContext, ToolDefinition } from '../types.js';

export interface CreateToolOptions<TInput = any, TOutput = any> {
  name: string;
  description: string;
  input?: any | undefined;
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
    return {
      name: optionsOrName,
      description,
      inputSchema: { type: 'object', properties: {} },
      execute,
    };
  }

  const inputSchema = optionsOrName.inputSchema ?? toJsonSchema(optionsOrName.input);

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

  // If JSango Validation Schema instance
  if (typeof schemaDef.toJsonSchema === 'function') {
    return schemaDef.toJsonSchema();
  }

  // If raw object with JSango field validators (e.g. { orderId: string() })
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [key, val] of Object.entries(schemaDef)) {
    if (val && typeof val === 'object') {
      if ((val as any).type === 'string' || (val as any).name === 'StringValidator') {
        properties[key] = { type: 'string' };
      } else if ((val as any).type === 'number' || (val as any).name === 'NumberValidator') {
        properties[key] = { type: 'number' };
      } else if ((val as any).type === 'boolean' || (val as any).name === 'BooleanValidator') {
        properties[key] = { type: 'boolean' };
      } else if ((val as any).type === 'array') {
        properties[key] = { type: 'array', items: { type: 'string' } };
      } else {
        properties[key] = { type: 'string' };
      }
      required.push(key);
    } else {
      properties[key] = { type: 'string' };
    }
  }

  return {
    type: 'object',
    properties,
    required: required.length > 0 ? required : undefined,
  };
}
