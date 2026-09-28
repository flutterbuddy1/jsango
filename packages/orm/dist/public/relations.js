export const relations = {
    belongsTo(target, options) {
        return {
            type: 'belongsTo',
            target,
            foreignKey: options.foreignKey,
            localKey: options.localKey ?? 'id',
            inverseRelation: options.inverseRelation,
            options: options.options,
        };
    },
    hasOne(target, options) {
        return {
            type: 'hasOne',
            target,
            foreignKey: options.foreignKey,
            localKey: options.localKey ?? 'id',
            inverseRelation: options.inverseRelation,
            options: options.options,
        };
    },
    hasMany(target, options) {
        return {
            type: 'hasMany',
            target,
            foreignKey: options.foreignKey,
            localKey: options.localKey ?? 'id',
            inverseRelation: options.inverseRelation,
            options: options.options,
        };
    },
    manyToMany(target, options) {
        return {
            type: 'manyToMany',
            target,
            through: options.through,
            foreignKey: options.foreignKey,
            localKey: options.localKey ?? 'id',
            pivotForeignKey: options.pivotForeignKey,
            pivotTargetKey: options.pivotTargetKey,
            inverseRelation: options.inverseRelation,
            options: options.options,
        };
    },
};
//# sourceMappingURL=relations.js.map