export class DashboardWidget {
    id;
    type;
    title;
    width;
    permission;
    refreshIntervalSeconds;
    constructor(config) {
        this.id = config.id;
        this.type = config.type;
        this.title = config.title;
        this.width = config.width ?? 'half';
        this.permission = config.permission;
        this.refreshIntervalSeconds = config.refreshIntervalSeconds;
    }
    toJSON() {
        return {
            id: this.id,
            type: this.type,
            title: this.title,
            width: this.width,
        };
    }
}
export class MetricWidget extends DashboardWidget {
    valueGetter;
    constructor(config) {
        super({ ...config, type: 'metric' });
        this.valueGetter = config.getValue;
    }
    async getData(context) {
        return this.valueGetter(context);
    }
}
export class TableWidget extends DashboardWidget {
    rowsGetter;
    constructor(config) {
        super({ ...config, type: 'table' });
        this.rowsGetter = config.getTableData;
    }
    async getData(context) {
        return this.rowsGetter(context);
    }
}
export class ChartWidget extends DashboardWidget {
    chartDataGetter;
    constructor(config) {
        super({ ...config, type: 'chart' });
        this.chartDataGetter = config.getChartData;
    }
    async getData(context) {
        return this.chartDataGetter(context);
    }
}
export class ActivityWidget extends DashboardWidget {
    activityGetter;
    constructor(config) {
        super({ ...config, type: 'activity' });
        this.activityGetter = config.getActivity;
    }
    async getData(context) {
        return this.activityGetter(context);
    }
}
export class AdminDashboard {
    widgets = new Map();
    registerWidget(widget) {
        this.widgets.set(widget.id, widget);
        return this;
    }
    getWidget(id) {
        return this.widgets.get(id);
    }
    getWidgets() {
        return [...this.widgets.values()];
    }
    async getDashboardData(context) {
        const result = {};
        for (const [id, widget] of this.widgets) {
            try {
                result[id] = await widget.getData(context);
            }
            catch {
                result[id] = null;
            }
        }
        return result;
    }
}
//# sourceMappingURL=dashboard.js.map