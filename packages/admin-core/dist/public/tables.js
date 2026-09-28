export class AdminColumn {
    name;
    label;
    sortable;
    align;
    width;
    hidden;
    constructor(config) {
        this.name = config.name;
        this.label = config.label;
        this.sortable = config.sortable ?? true;
        this.align = config.align ?? 'left';
        this.width = config.width;
        this.hidden = config.hidden ?? false;
    }
}
export class AdminTable {
    columns;
    constructor(columns) {
        this.columns = columns.map((col) => new AdminColumn(col));
    }
}
//# sourceMappingURL=tables.js.map