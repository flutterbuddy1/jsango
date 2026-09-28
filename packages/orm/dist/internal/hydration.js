export class Hydrator {
    static hydrateRow(rawRow, metadata) {
        const attributes = {};
        for (const [colName, val] of Object.entries(rawRow)) {
            const fieldName = metadata.columnToField(colName);
            const fieldMeta = metadata.getField(fieldName);
            if (!fieldMeta || val === null || val === undefined) {
                attributes[fieldName] = val ?? null;
                continue;
            }
            switch (fieldMeta.type) {
                case 'dateTime':
                case 'date':
                case 'time':
                    if (val instanceof Date) {
                        attributes[fieldName] = val;
                    }
                    else if (typeof val === 'string' || typeof val === 'number') {
                        attributes[fieldName] = new Date(val);
                    }
                    else {
                        attributes[fieldName] = val;
                    }
                    break;
                case 'boolean':
                    if (typeof val === 'boolean') {
                        attributes[fieldName] = val;
                    }
                    else if (typeof val === 'number') {
                        attributes[fieldName] = val !== 0;
                    }
                    else if (typeof val === 'string') {
                        attributes[fieldName] = val === 'true' || val === '1' || val === 't';
                    }
                    else {
                        attributes[fieldName] = Boolean(val);
                    }
                    break;
                case 'integer':
                case 'float':
                case 'decimal':
                    if (typeof val === 'number') {
                        attributes[fieldName] = val;
                    }
                    else if (typeof val === 'string') {
                        const num = Number(val);
                        attributes[fieldName] = Number.isNaN(num) ? val : num;
                    }
                    else {
                        attributes[fieldName] = val;
                    }
                    break;
                case 'bigint':
                    if (typeof val === 'bigint') {
                        attributes[fieldName] = val;
                    }
                    else if (typeof val === 'number' || typeof val === 'string') {
                        try {
                            attributes[fieldName] = BigInt(val);
                        }
                        catch {
                            attributes[fieldName] = val;
                        }
                    }
                    else {
                        attributes[fieldName] = val;
                    }
                    break;
                case 'json':
                    if (typeof val === 'string') {
                        try {
                            attributes[fieldName] = JSON.parse(val);
                        }
                        catch {
                            attributes[fieldName] = val;
                        }
                    }
                    else {
                        attributes[fieldName] = val;
                    }
                    break;
                default:
                    attributes[fieldName] = val;
                    break;
            }
        }
        return attributes;
    }
    static hydrateModel(rawRow, modelClass) {
        const attributes = this.hydrateRow(rawRow, modelClass.metadata);
        return new modelClass(attributes, false);
    }
    static hydrateModels(rawRows, modelClass) {
        return rawRows.map((row) => this.hydrateModel(row, modelClass));
    }
}
//# sourceMappingURL=hydration.js.map