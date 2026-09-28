export class AdminFilter {
    name;
    type;
    field;
    label;
    choices;
    constructor(config) {
        this.name = config.name;
        this.type = config.type;
        this.field = config.field;
        this.label = config.label ?? config.name;
        this.choices = config.choices;
    }
    toJSON() {
        return {
            name: this.name,
            type: this.type,
            field: this.field,
            label: this.label,
            choices: this.choices,
        };
    }
}
//# sourceMappingURL=filters.js.map