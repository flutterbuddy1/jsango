export class AdminPage {
    id;
    path;
    label;
    navigationGroup;
    navigationIcon;
    navigationOrder;
    permission;
    constructor(config) {
        this.id = config.id;
        this.path = config.path;
        this.label = config.label;
        this.navigationGroup = config.navigationGroup;
        this.navigationIcon = config.navigationIcon;
        this.navigationOrder = config.navigationOrder;
        this.permission = config.permission;
    }
    toJSON() {
        return {
            id: this.id,
            path: this.path,
            label: this.label,
            navigationGroup: this.navigationGroup,
            navigationIcon: this.navigationIcon,
            navigationOrder: this.navigationOrder,
            permission: this.permission,
        };
    }
}
//# sourceMappingURL=pages.js.map