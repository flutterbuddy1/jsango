export function tool(optionsOrName, description, execute) {
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
export function toJsonSchema(schemaDef) {
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
    const properties = {};
    const required = [];
    for (const [key, val] of Object.entries(schemaDef)) {
        if (val && typeof val === 'object') {
            if (val.type === 'string' || val.name === 'StringValidator') {
                properties[key] = { type: 'string' };
            }
            else if (val.type === 'number' || val.name === 'NumberValidator') {
                properties[key] = { type: 'number' };
            }
            else if (val.type === 'boolean' || val.name === 'BooleanValidator') {
                properties[key] = { type: 'boolean' };
            }
            else if (val.type === 'array') {
                properties[key] = { type: 'array', items: { type: 'string' } };
            }
            else {
                properties[key] = { type: 'string' };
            }
            required.push(key);
        }
        else {
            properties[key] = { type: 'string' };
        }
    }
    return {
        type: 'object',
        properties,
        required: required.length > 0 ? required : undefined,
    };
}
//# sourceMappingURL=tool.js.map