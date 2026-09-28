/**
 * Admin API Error representation
 */
export class AdminApiError extends Error {
    code;
    status;
    fieldErrors;
    metadata;
    constructor(options) {
        super(options.message);
        this.name = 'AdminApiError';
        this.code = options.code;
        this.status = options.status;
        this.fieldErrors = options.fieldErrors;
        this.metadata = options.metadata;
    }
}
//# sourceMappingURL=errors.js.map