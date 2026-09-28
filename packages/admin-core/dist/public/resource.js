import { AdminField } from './fields.js';
import { AdminFilter } from './filters.js';
import { AdminAction, AdminBulkAction } from './actions.js';
export class AdminResource {
    id;
    modelName;
    label;
    pluralLabel;
    navigationGroup;
    navigationIcon;
    navigationOrder;
    primaryKey;
    fields = new Map();
    listFields;
    detailFields;
    createFields;
    editFields;
    searchFields;
    defaultSortField;
    defaultSortDirection;
    defaultPageSize;
    maxPageSize;
    filters = new Map();
    actions = new Map();
    bulkActions = new Map();
    canSoftDelete;
    constructor(options) {
        this.modelName = options.modelName ?? options.id ?? 'Unknown';
        this.id = options.id ?? this.modelName.toLowerCase();
        this.label = options.label ?? AdminField.formatLabel(this.modelName);
        this.pluralLabel = options.pluralLabel ?? `${this.label}s`;
        this.navigationGroup = options.navigationGroup;
        this.navigationIcon = options.navigationIcon;
        this.navigationOrder = options.navigationOrder;
        this.primaryKey = options.primaryKey ?? 'id';
        if (options.fields) {
            for (const f of options.fields) {
                this.fields.set(f.name, new AdminField(f));
            }
        }
        const allFieldNames = [...this.fields.keys()];
        this.listFields =
            options.listFields ??
                allFieldNames.filter((n) => !this.fields.get(n)?.hidden && !this.fields.get(n)?.sensitive);
        this.detailFields =
            options.detailFields ?? allFieldNames.filter((n) => !this.fields.get(n)?.hidden);
        this.createFields =
            options.createFields ??
                allFieldNames.filter((n) => n !== this.primaryKey && !this.fields.get(n)?.readonly && !this.fields.get(n)?.hidden);
        this.editFields =
            options.editFields ??
                allFieldNames.filter((n) => n !== this.primaryKey && !this.fields.get(n)?.readonly && !this.fields.get(n)?.hidden);
        this.searchFields =
            options.searchFields ?? allFieldNames.filter((n) => this.fields.get(n)?.searchable);
        this.defaultSortField = options.defaultSortField ?? this.primaryKey;
        this.defaultSortDirection = options.defaultSortDirection ?? 'asc';
        this.defaultPageSize = options.defaultPageSize ?? 25;
        this.maxPageSize = options.maxPageSize ?? 100;
        this.canSoftDelete = options.canSoftDelete ?? false;
        if (options.filters) {
            for (const filter of options.filters) {
                this.filters.set(filter.name, new AdminFilter(filter));
            }
        }
        if (options.actions) {
            for (const action of options.actions) {
                this.actions.set(action.id, new AdminAction(action));
            }
        }
        if (options.bulkActions) {
            for (const bulkAction of options.bulkActions) {
                this.bulkActions.set(bulkAction.id, new AdminBulkAction(bulkAction));
            }
        }
    }
    getField(name) {
        return this.fields.get(name);
    }
    _cachedSchema;
    getSchema() {
        if (this._cachedSchema) {
            return this._cachedSchema;
        }
        this._cachedSchema = {
            id: this.id,
            label: this.label,
            pluralLabel: this.pluralLabel,
            navigationGroup: this.navigationGroup,
            navigationIcon: this.navigationIcon,
            navigationOrder: this.navigationOrder,
            primaryKey: this.primaryKey,
            fields: [...this.fields.values()].map((f) => f.toJSON()),
            listFields: this.listFields,
            detailFields: this.detailFields,
            createFields: this.createFields,
            editFields: this.editFields,
            searchFields: this.searchFields,
            defaultSortField: this.defaultSortField,
            defaultSortDirection: this.defaultSortDirection,
            defaultPageSize: this.defaultPageSize,
            maxPageSize: this.maxPageSize,
            filters: [...this.filters.values()].map((flt) => flt.toJSON()),
            actions: [...this.actions.values()].map((a) => a.toJSON()),
            bulkActions: [...this.bulkActions.values()].map((ba) => ba.toJSON()),
            canSoftDelete: this.canSoftDelete,
        };
        return this._cachedSchema;
    }
}
//# sourceMappingURL=resource.js.map