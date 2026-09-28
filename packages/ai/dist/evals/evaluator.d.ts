import type { EvaluationCase, EvaluationResult } from '../types.js';
import { Agent } from '../agents/agent.js';
export declare function evaluate(name: string, cases: EvaluationCase[], target: Agent | ((input: string) => Promise<string>)): Promise<EvaluationResult>;
//# sourceMappingURL=evaluator.d.ts.map