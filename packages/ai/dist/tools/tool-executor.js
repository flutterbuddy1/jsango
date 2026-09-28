import { ToolError } from '../errors.js';
export class ToolExecutor {
    static async execute(options) {
        const { tool, arguments: args, context = {}, approvalGranted = false } = options;
        const start = Date.now();
        // 1. Authorization check
        if (tool.permissions && tool.permissions.length > 0) {
            const user = context.user;
            if (!user) {
                throw new ToolError(tool.name, `Unauthorized: Tool '${tool.name}' requires permissions [${tool.permissions.join(', ')}], but no authenticated identity was provided.`);
            }
            if (typeof user.hasPermission === 'function') {
                const allowed = await Promise.all(tool.permissions.map((p) => user.hasPermission(p)));
                if (!allowed.every(Boolean)) {
                    throw new ToolError(tool.name, `Forbidden: User lacks required permissions for tool '${tool.name}'.`);
                }
            }
        }
        // 2. Human Approval check
        if (tool.requiresApproval && !approvalGranted) {
            const approvalId = `appr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            return {
                toolName: tool.name,
                input: args,
                approvalRequired: true,
                approvalId,
                durationMs: Date.now() - start,
            };
        }
        // 3. Execution with Timeout
        const timeoutMs = tool.timeoutMs ?? 30000;
        try {
            const execPromise = Promise.resolve(tool.execute(args, context));
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error(`Execution timed out after ${timeoutMs}ms`)), timeoutMs);
            });
            const output = await Promise.race([execPromise, timeoutPromise]);
            return {
                toolName: tool.name,
                input: args,
                output,
                durationMs: Date.now() - start,
            };
        }
        catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            return {
                toolName: tool.name,
                input: args,
                error: errorMsg,
                durationMs: Date.now() - start,
            };
        }
    }
}
//# sourceMappingURL=tool-executor.js.map