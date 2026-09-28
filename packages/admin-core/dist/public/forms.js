export class AdminFormField {
    name;
    label;
    required;
    readonly;
    hidden;
    helpText;
    constructor(config) {
        this.name = config.name;
        this.label = config.label;
        this.required = config.required ?? false;
        this.readonly = config.readonly ?? false;
        this.hidden = config.hidden ?? false;
        this.helpText = config.helpText;
    }
}
export class AdminForm {
    fields;
    constructor(fields) {
        this.fields = fields.map((f) => new AdminFormField({
            name: f.name,
            label: f.label,
            required: f.required,
            readonly: f.readonly,
            hidden: f.hidden,
            helpText: f.description,
        }));
    }
}
//# sourceMappingURL=forms.js.map