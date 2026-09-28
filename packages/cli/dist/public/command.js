export class BaseCommand {
    usage;
    aliases;
    arguments;
    options;
    examples;
    hidden;
}
export function defineCommand(definition) {
    return {
        ...definition,
        execute: definition.execute,
    };
}
//# sourceMappingURL=command.js.map