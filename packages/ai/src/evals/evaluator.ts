import type { EvaluationCase, EvaluationResult, LlmUsage } from '../types.js';
import { Agent } from '../agents/agent.js';

export async function evaluate(
  name: string,
  cases: EvaluationCase[],
  target: Agent | ((input: string) => Promise<string>)
): Promise<EvaluationResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const usage: LlmUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  let passedCount = 0;

  for (let i = 0; i < cases.length; i++) {
    const c = cases[i]!;
    const caseStart = Date.now();

    try {
      let outputText = '';
      const executedTools: string[] = [];

      if (target instanceof Agent) {
        const runRes = await target.run({ input: c.input });
        outputText = runRes.text;
        executedTools.push(...runRes.toolCalls.map((tc) => tc.name));
        usage.promptTokens += runRes.usage.promptTokens;
        usage.completionTokens += runRes.usage.completionTokens;
        usage.totalTokens += runRes.usage.totalTokens;

        if (c.expectedTools) {
          for (const requiredTool of c.expectedTools) {
            if (!executedTools.includes(requiredTool)) {
              errors.push(`Case #${i + 1} failed: expected tool '${requiredTool}' was not called.`);
            }
          }
        }
      } else {
        outputText = await target(c.input);
      }

      if (c.expected !== undefined) {
        if (typeof c.expected === 'string') {
          if (!outputText.includes(c.expected)) {
            errors.push(`Case #${i + 1} failed: output does not contain expected substring "${c.expected}".`);
          }
        } else if (c.expected instanceof RegExp) {
          if (!c.expected.test(outputText)) {
            errors.push(`Case #${i + 1} failed: output does not match pattern ${c.expected}.`);
          }
        } else if (typeof c.expected === 'function') {
          const pass = await c.expected({ text: outputText } as any);
          if (!pass) {
            errors.push(`Case #${i + 1} failed custom assertion.`);
          }
        }
      }

      if (c.maxDurationMs) {
        const duration = Date.now() - caseStart;
        if (duration > c.maxDurationMs) {
          errors.push(`Case #${i + 1} exceeded max duration: ${duration}ms > ${c.maxDurationMs}ms`);
        }
      }

      if (errors.length === 0) {
        passedCount++;
      }
    } catch (err: unknown) {
      errors.push(`Case #${i + 1} threw error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const passed = errors.length === 0 && passedCount === cases.length;
  const score = cases.length > 0 ? (passedCount / cases.length) * 100 : 100;

  return {
    name,
    passed,
    score,
    durationMs: Date.now() - startTime,
    usage,
    errors,
  };
}

