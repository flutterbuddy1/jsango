export class AdminAction {
    id;
    label;
    description;
    permission;
    requiresConfirmation;
    confirmationMessage;
    inputSchema;
    handler;
    constructor(config) {
        this.id = config.id;
        this.label = config.label;
        this.description = config.description;
        this.permission = config.permission;
        this.requiresConfirmation = config.requiresConfirmation ?? false;
        this.confirmationMessage = config.confirmationMessage;
        this.inputSchema = config.inputSchema;
        this.handler = config.handler;
    }
    toJSON() {
        return {
            id: this.id,
            label: this.label,
            requiresConfirmation: this.requiresConfirmation,
            confirmationMessage: this.confirmationMessage,
        };
    }
}
export class AdminBulkAction {
    id;
    label;
    description;
    permission;
    requiresConfirmation;
    confirmationMessage;
    inputSchema;
    handler;
    constructor(config) {
        this.id = config.id;
        this.label = config.label;
        this.description = config.description;
        this.permission = config.permission;
        this.requiresConfirmation = config.requiresConfirmation ?? false;
        this.confirmationMessage = config.confirmationMessage;
        this.inputSchema = config.inputSchema;
        this.handler = config.handler;
    }
    toJSON() {
        return {
            id: this.id,
            label: this.label,
            requiresConfirmation: this.requiresConfirmation,
            confirmationMessage: this.confirmationMessage,
        };
    }
}
//# sourceMappingURL=actions.js.map