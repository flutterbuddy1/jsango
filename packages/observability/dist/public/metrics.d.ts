import type { MetricLabels, MetricDefinition, CounterValue, GaugeValue, HistogramValue, MetricSnapshot } from './types.js';
export declare const DEFAULT_HISTOGRAM_BUCKETS: number[];
export declare class Counter {
    readonly name: string;
    readonly description: string;
    readonly labelNames: readonly string[];
    private readonly values;
    private readonly maxCardinality;
    constructor(definition: MetricDefinition, maxCardinality?: number);
    inc(amount?: number, labels?: MetricLabels): void;
    get(labels?: MetricLabels): number;
    getValues(): readonly CounterValue[];
    reset(): void;
}
export declare class Gauge {
    readonly name: string;
    readonly description: string;
    readonly labelNames: readonly string[];
    private readonly values;
    private readonly maxCardinality;
    constructor(definition: MetricDefinition, maxCardinality?: number);
    set(value: number, labels?: MetricLabels): void;
    inc(amount?: number, labels?: MetricLabels): void;
    dec(amount?: number, labels?: MetricLabels): void;
    get(labels?: MetricLabels): number;
    getValues(): readonly GaugeValue[];
    reset(): void;
}
export declare class Histogram {
    readonly name: string;
    readonly description: string;
    readonly labelNames: readonly string[];
    readonly buckets: readonly number[];
    private readonly values;
    private readonly maxCardinality;
    constructor(definition: MetricDefinition & {
        readonly buckets?: readonly number[] | undefined;
    }, maxCardinality?: number);
    observe(value: number, labels?: MetricLabels): void;
    get(labels?: MetricLabels): HistogramValue | undefined;
    getValues(): readonly HistogramValue[];
    reset(): void;
}
export declare class MetricRegistry {
    private readonly counters;
    private readonly gauges;
    private readonly histograms;
    private readonly maxCardinalityPerMetric;
    constructor(maxCardinalityPerMetric?: number);
    counter(name: string, description: string, labelNames?: readonly string[]): Counter;
    gauge(name: string, description: string, labelNames?: readonly string[]): Gauge;
    histogram(name: string, description: string, buckets?: readonly number[], labelNames?: readonly string[]): Histogram;
    snapshot(): readonly MetricSnapshot[];
    resetAll(): void;
    private assertNoConflict;
}
//# sourceMappingURL=metrics.d.ts.map