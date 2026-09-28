import { JsangoError } from '@jsango/core';
export class OrmError extends JsangoError {
    constructor(options) {
        super(options);
        this.name = 'OrmError';
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
export class ModelNotFoundError extends OrmError {
    modelName;
    primaryKey;
    constructor(modelName, primaryKey) {
        super({
            code: 'ERR_ORM_MODEL_NOT_FOUND',
            message: `Model '${modelName}' with primary key '${String(primaryKey)}' was not found.`,
            statusCode: 404,
            metadata: { modelName, primaryKey: String(primaryKey) },
        });
        this.name = 'ModelNotFoundError';
        this.modelName = modelName;
        this.primaryKey = primaryKey;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
export class ModelValidationError extends OrmError {
    modelName;
    errors;
    constructor(modelName, message, errors = []) {
        super({
            code: 'ERR_ORM_VALIDATION_FAILED',
            message: `Validation failed for model '${modelName}': ${message}`,
            statusCode: 400,
            metadata: { modelName, errors: [...errors] },
        });
        this.name = 'ModelValidationError';
        this.modelName = modelName;
        this.errors = Object.freeze([...errors]);
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
export class RelationError extends OrmError {
    modelName;
    relationName;
    constructor(modelName, relationName, message) {
        super({
            code: 'ERR_ORM_RELATION_ERROR',
            message: `Relation error on '${modelName}.${relationName}': ${message}`,
            statusCode: 500,
            metadata: { modelName, relationName },
        });
        this.name = 'RelationError';
        this.modelName = modelName;
        this.relationName = relationName;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
export class MetadataError extends OrmError {
    constructor(message, metadata) {
        super({
            code: 'ERR_ORM_METADATA_ERROR',
            message,
            statusCode: 500,
            metadata,
        });
        this.name = 'MetadataError';
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
export class QueryError extends OrmError {
    querySql;
    constructor(message, querySql, cause) {
        super({
            code: 'ERR_ORM_QUERY_FAILED',
            message,
            statusCode: 500,
            cause,
            metadata: querySql ? { sql: querySql } : undefined,
        });
        this.name = 'QueryError';
        this.querySql = querySql;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
//# sourceMappingURL=errors.js.map