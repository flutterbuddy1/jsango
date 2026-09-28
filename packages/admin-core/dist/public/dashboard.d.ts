export type DashboardWidgetType = 'metric' | 'table' | 'chart' | 'activity' | 'custom';
export interface DashboardWidgetConfig {
    readonly id: string;
    readonly type: DashboardWidgetType;
    readonly title: string;
    readonly width?: 'full' | 'half' | 'third' | 'quarter' | undefined;
    readonly permission?: string | undefined;
    readonly refreshIntervalSeconds?: number | undefined;
}
export declare abstract class DashboardWidget {
    readonly id: string;
    readonly type: DashboardWidgetType;
    readonly title: string;
    readonly width: 'full' | 'half' | 'third' | 'quarter';
    readonly permission?: string | undefined;
    readonly refreshIntervalSeconds?: number | undefined;
    constructor(config: DashboardWidgetConfig);
    abstract getData(context?: unknown): Promise<unknown> | unknown;
    toJSON(): {
        id: string;
        type: DashboardWidgetType;
        title: string;
        width: string;
    };
}
export declare class MetricWidget extends DashboardWidget {
    private readonly valueGetter;
    constructor(config: DashboardWidgetConfig & {
        readonly getValue: (ctx?: unknown) => Promise<string | number | {
            value: string | number;
            change?: number;
            trend?: 'up' | 'down' | 'neutral';
        }> | string | number | {
            value: string | number;
            change?: number;
            trend?: 'up' | 'down' | 'neutral';
        };
    });
    getData(context?: unknown): Promise<unknown>;
}
export declare class TableWidget extends DashboardWidget {
    private readonly rowsGetter;
    constructor(config: DashboardWidgetConfig & {
        readonly getTableData: (ctx?: unknown) => Promise<{
            headers: string[];
            rows: unknown[][];
        }> | {
            headers: string[];
            rows: unknown[][];
        };
    });
    getData(context?: unknown): Promise<unknown>;
}
export declare class ChartWidget extends DashboardWidget {
    private readonly chartDataGetter;
    constructor(config: DashboardWidgetConfig & {
        readonly getChartData: (ctx?: unknown) => Promise<{
            labels: string[];
            datasets: Array<{
                label: string;
                data: number[];
            }>;
        }> | {
            labels: string[];
            datasets: Array<{
                label: string;
                data: number[];
            }>;
        };
    });
    getData(context?: unknown): Promise<unknown>;
}
export declare class ActivityWidget extends DashboardWidget {
    private readonly activityGetter;
    constructor(config: DashboardWidgetConfig & {
        readonly getActivity: (ctx?: unknown) => Promise<Array<{
            id: string;
            title: string;
            subtitle?: string;
            timestamp: number;
            icon?: string;
        }>> | Array<{
            id: string;
            title: string;
            subtitle?: string;
            timestamp: number;
            icon?: string;
        }>;
    });
    getData(context?: unknown): Promise<unknown>;
}
export declare class AdminDashboard {
    private readonly widgets;
    registerWidget(widget: DashboardWidget): this;
    getWidget(id: string): DashboardWidget | undefined;
    getWidgets(): readonly DashboardWidget[];
    getDashboardData(context?: unknown): Promise<Record<string, unknown>>;
}
//# sourceMappingURL=dashboard.d.ts.map