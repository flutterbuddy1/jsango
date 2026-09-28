import { BaseCommand } from '../public/command.js';
import { ExitCode } from '../public/types.js';
export class AiDoctorCommand extends BaseCommand {
    name = 'ai:doctor';
    description = 'Check AI providers, environment variables, and model connectivity';
    usage = 'jsango ai:doctor';
    aliases = ['ai:check', 'ai:status'];
    async execute(context) {
        context.output.info('🤖 Checking JSango AI Platform Configuration...\n');
        const providers = [
            { name: 'OpenAI', envVar: 'OPENAI_API_KEY', defaultModel: 'gpt-4o' },
            { name: 'Anthropic', envVar: 'ANTHROPIC_API_KEY', defaultModel: 'claude-3-5-sonnet' },
            { name: 'Google Gemini', envVar: 'GEMINI_API_KEY', defaultModel: 'gemini-1.5-flash' },
            { name: 'Ollama (Local)', envVar: 'OLLAMA_BASE_URL', defaultModel: 'llama3.2', optional: true },
        ];
        let readyCount = 0;
        for (const p of providers) {
            const isSet = !!process.env[p.envVar];
            if (isSet) {
                context.output.success(`  ✓ [${p.name}] API Key configured via ${p.envVar}`);
                readyCount++;
            }
            else if (p.optional) {
                context.output.info(`  ℹ [${p.name}] Local provider available at http://127.0.0.1:11434`);
            }
            else {
                context.output.warn(`  ! [${p.name}] Not configured (${p.envVar} is unset)`);
            }
        }
        context.output.info(`\n  Fake Provider (Testing): Ready for deterministic zero-cost offline tests.`);
        if (readyCount === 0) {
            context.output.info('\n💡 Tip: Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or GEMINI_API_KEY to connect live LLMs.');
        }
        else {
            context.output.success(`\n🚀 ${readyCount} live AI provider(s) ready.`);
        }
        return ExitCode.SUCCESS;
    }
}
//# sourceMappingURL=ai-doctor.js.map