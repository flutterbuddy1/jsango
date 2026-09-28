function createField(type, options) {
    const { defaultValue, maxLength, ...rest } = options ?? {};
    return {
        type,
        default: defaultValue ?? options?.default,
        length: maxLength ?? options?.length,
        maxLength: maxLength ?? options?.length,
        ...rest,
    };
}
export const fields = {
    id(options) {
        return createField('integer', {
            primaryKey: true,
            autoIncrement: true,
            ...options,
        });
    },
    string(options) {
        return createField('string', options);
    },
    number(options) {
        return createField('float', options);
    },
    text(options) {
        return createField('text', options);
    },
    integer(options) {
        return createField('integer', options);
    },
    bigint(options) {
        return createField('bigint', options);
    },
    float(options) {
        return createField('float', options);
    },
    decimal(options) {
        return createField('decimal', options);
    },
    boolean(options) {
        return createField('boolean', options);
    },
    dateTime(options) {
        return createField('dateTime', options);
    },
    date(options) {
        return createField('date', options);
    },
    time(options) {
        return createField('time', options);
    },
    json(options) {
        return createField('json', options);
    },
    uuid(options) {
        return createField('uuid', options);
    },
    binary(options) {
        return createField('binary', options);
    },
};
//# sourceMappingURL=fields.js.map