import type { ToolContext, ToolDefinition } from '../types.js';
import { ToolError } from '../errors.js';

export interface ExecuteToolOptions {
  tool: ToolDefinition;
  arguments: Record<string, unknown>;
  context?: ToolContext | undefined;
  approvalGranted?: boolean | undefined;
}

export interface ToolExecutionResult {
  toolName: string;
  input: Record<string, unknown>;
  output?: unknown | undefined;
  error?: string | undefined;
  durationMs: number;
  approvalRequired?: boolean | undefined;
  approvalId?: string | undefined;
}

export class ToolExecutor {
  public static async execute(options: ExecuteToolOptions): Promise<ToolExecutionResult> {
    const { tool, arguments: args, context = {}, approvalGranted = false } = options;
    const start = Date.now();

    // 1. Authorization check
    if (tool.permissions && tool.permissions.length > 0) {
      const user = context.user;
      if (!user) {
        throw new ToolError(
          tool.name,
          `Unauthorized: Tool '${tool.name}' requires permissions [${tool.permissions.join(', ')}], but no authenticated identity was provided.`
        );
      }
      // Accept identities with hasPermission() (jsango auth) or a plain `permissions` array.
      // Anything else cannot prove its permissions and is denied.
      let allowed: boolean;
      if (typeof user.hasPermission === 'function') {
        allowed = (await Promise.all(tool.permissions.map((p) => user.hasPermission(p)))).every(Boolean);
      } else if (Array.isArray(user.permissions)) {
        allowed = tool.permissions.every((p) => (user.permissions as unknown[]).includes(p));
      } else {
        allowed = false;
      }
      if (!allowed) {
        throw new ToolError(tool.name, `Forbidden: User lacks required permissions for tool '${tool.name}'.`);
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
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Execution timed out after ${timeoutMs}ms`)), timeoutMs);
      });

      const output = await Promise.race([execPromise, timeoutPromise]).finally(() => clearTimeout(timer));

      return {
        toolName: tool.name,
        input: args,
        output,
        durationMs: Date.now() - start,
      };
    } catch (err: unknown) {
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
