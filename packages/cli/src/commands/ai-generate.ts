import * as fs from 'node:fs';
import * as path from 'node:path';
import { BaseCommand } from '../public/command.js';
import type { CommandContext } from '../public/context.js';
import { ExitCode } from '../public/types.js';

export class AiGenerateCommand extends BaseCommand {
  public readonly name = 'make:agent';
  public readonly description = 'Generate a new typed AI Agent and Tool definition for JSango';
  public readonly usage = 'jsango make:agent <AgentName> [options]';
  public readonly aliases = ['ai:agent', 'generate:agent', 'make:tool'];
  public readonly options = [
    {
      name: 'output',
      short: 'o',
      description: 'Output directory for agent files (default: src/agents)',
      type: 'string' as const,
      default: 'src/agents',
    },
    {
      name: 'model',
      short: 'm',
      description: 'LLM model to use (default: openai:gpt-4o)',
      type: 'string' as const,
      default: 'openai:gpt-4o',
    },
  ];

  public async execute(context: CommandContext): Promise<number> {
    const rawName = context.args[0] ? String(context.args[0]) : '';
    if (!rawName) {
      context.output.error('Agent name is required. Usage: jsango make:agent <AgentName>');
      return ExitCode.USAGE_ERROR;
    }

    const agentName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
    const kebabName = rawName.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase();
    const outputDir = (context.options['output'] as string | undefined) ?? 'src/agents';
    const model = (context.options['model'] as string | undefined) ?? 'openai:gpt-4o';

    const fullOutputDir = path.resolve(process.cwd(), outputDir);
    if (!fs.existsSync(fullOutputDir)) {
      fs.mkdirSync(fullOutputDir, { recursive: true });
    }

    const agentFilePath = path.join(fullOutputDir, `${kebabName}.ts`);

    const agentCode = `import { agent, tool, string, schema } from 'jsango';

// Sample Tool Definition
export const searchKnowledgeTool = tool({
  name: 'search_knowledge',
  description: 'Search internal knowledge base',
  input: schema({
    query: string().min(2),
  }),
  execute: async ({ query }) => {
    return { results: [\`Relevant findings for: \${query}\`] };
  },
});

// ${agentName} Definition
export const ${agentName} = agent({
  name: '${agentName}',
  model: '${model}',
  instructions: \`
    You are a professional assistant. Help users with their questions accurately and politely.
    Use available tools when necessary.
  \`,
  tools: {
    searchKnowledge: searchKnowledgeTool,
  },
  memory: 'conversation',
});
`;

    fs.writeFileSync(agentFilePath, agentCode, 'utf8');
    context.output.success(`Created agent at: ${path.relative(process.cwd(), agentFilePath)}`);

    return ExitCode.SUCCESS;
  }
}
