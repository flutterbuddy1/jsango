export const DEFAULT_HISTOGRAM_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
function serializeLabels(labels = {}) {
    const keys = Object.keys(labels);
    if (keys.length === 0)
        return '';
    if (keys.length === 1) {
        const k = keys[0];
        return `${k}=${String(labels[k])}`;
    }
    keys.sort();
    return keys.map((k) => `${k}=${String(labels[k])}`).join(',');
}
export class Counter {
    name;
    description;
    labelNames;
    values = new Map();
    maxCardinality;
    constructor(definition, maxCardinality = 1000) {
        this.name = definition.name;
        this.description = definition.description;
        this.labelNames = definition.labelNames ?? [];
        this.maxCardinality = maxCardinality;
    }
    inc(amount = 1, labels = {}) {
        if (amount < 0) {
            throw new Error(`Counter ${this.name} cannot be incremented by a negative value (${amount}).`);
        }
        const key = serializeLabels(labels);
        const entry = this.values.get(key);
        if (entry) {
            entry.value += amount;
        }
        else {
            if (this.values.size >= this.maxCardinality) {
                // High-cardinality safety protection: drop new dimension to avoid OOM
                return;
            }
            this.values.set(key, { labels: { ...labels }, value: amount });
        }
    }
    get(labels = {}) {
        const key = serializeLabels(labels);
        return this.values.get(key)?.value ?? 0;
    }
    getValues() {
        return Array.from(this.values.values());
    }
    reset() {
        this.values.clear();
    }
}
export class Gauge {
    name;
    description;
    labelNames;
    values = new Map();
    maxCardinality;
    constructor(definition, maxCardinality = 1000) {
        this.name = definition.name;
        this.description = definition.description;
        this.labelNames = definition.labelNames ?? [];
        this.maxCardinality = maxCardinality;
    }
    set(value, labels = {}) {
        const key = serializeLabels(labels);
        const entry = this.values.get(key);
        if (entry) {
            entry.value = value;
        }
        else {
            if (this.values.size >= this.maxCardinality)
                return;
            this.values.set(key, { labels: { ...labels }, value });
        }
    }
    inc(amount = 1, labels = {}) {
        const key = serializeLabels(labels);
        const entry = this.values.get(key);
        if (entry) {
            entry.value += amount;
        }
        else {
            if (this.values.size >= this.maxCardinality)
                return;
            this.values.set(key, { labels: { ...labels }, value: amount });
        }
    }
    dec(amount = 1, labels = {}) {
        this.inc(-amount, labels);
    }
    get(labels = {}) {
        const key = serializeLabels(labels);
        return this.values.get(key)?.value ?? 0;
    }
    getValues() {
        return Array.from(this.values.values());
    }
    reset() {
        this.values.clear();
    }
}
export class Histogram {
    name;
    description;
    labelNames;
    buckets;
    values = new Map();
    maxCardinality;
    constructor(definition, maxCardinality = 1000) {
        this.name = definition.name;
        this.description = definition.description;
        this.labelNames = definition.labelNames ?? [];
        this.buckets = Object.freeze([...(definition.buckets ?? DEFAULT_HISTOGRAM_BUCKETS)].sort((a, b) => a - b));
        this.maxCardinality = maxCardinality;
    }
    observe(value, labels = {}) {
        const key = serializeLabels(labels);
        let entry = this.values.get(key);
        if (!entry) {
            if (this.values.size >= this.maxCardinality)
                return;
            entry = {
                labels: { ...labels },
                count: 0,
                sum: 0,
                min: value,
                max: value,
                bucketCounts: new Array(this.buckets.length).fill(0),
            };
            this.values.set(key, entry);
        }
        entry.count += 1;
        entry.sum += value;
        if (value < entry.min)
            entry.min = value;
        if (value > entry.max)
            entry.max = value;
        for (let i = 0; i < this.buckets.length; i++) {
            const bound = this.buckets[i];
            if (bound !== undefined && value <= bound) {
                entry.bucketCounts[i] = (entry.bucketCounts[i] ?? 0) + 1;
            }
        }
    }
    get(labels = {}) {
        const key = serializeLabels(labels);
        const entry = this.values.get(key);
        if (!entry)
            return undefined;
        const buckets = this.buckets.map((le, idx) => ({
            le,
            count: entry.bucketCounts[idx] ?? 0,
        }));
        return {
            labels: entry.labels,
            count: entry.count,
            sum: entry.sum,
            min: entry.min,
            max: entry.max,
            buckets,
        };
    }
    getValues() {
        return Array.from(this.values.values()).map((entry) => ({
            labels: entry.labels,
            count: entry.count,
            sum: entry.sum,
            min: entry.min,
            max: entry.max,
            buckets: this.buckets.map((le, idx) => ({
                le,
                count: entry.bucketCounts[idx] ?? 0,
            })),
        }));
    }
    reset() {
        this.values.clear();
    }
}
export class MetricRegistry {
    counters = new Map();
    gauges = new Map();
    histograms = new Map();
    maxCardinalityPerMetric;
    constructor(maxCardinalityPerMetric = 1000) {
        this.maxCardinalityPerMetric = maxCardinalityPerMetric;
    }
    counter(name, description, labelNames) {
        const existing = this.counters.get(name);
        if (existing)
            return existing;
        this.assertNoConflict(name, 'counter');
        const counter = new Counter({ name, type: 'counter', description, labelNames }, this.maxCardinalityPerMetric);
        this.counters.set(name, counter);
        return counter;
    }
    gauge(name, description, labelNames) {
        const existing = this.gauges.get(name);
        if (existing)
            return existing;
        this.assertNoConflict(name, 'gauge');
        const gauge = new Gauge({ name, type: 'gauge', description, labelNames }, this.maxCardinalityPerMetric);
        this.gauges.set(name, gauge);
        return gauge;
    }
    histogram(name, description, buckets, labelNames) {
        const existing = this.histograms.get(name);
        if (existing)
            return existing;
        this.assertNoConflict(name, 'histogram');
        const histogram = new Histogram({ name, type: 'histogram', description, buckets, labelNames }, this.maxCardinalityPerMetric);
        this.histograms.set(name, histogram);
        return histogram;
    }
    snapshot() {
        const snapshots = [];
        for (const counter of this.counters.values()) {
            snapshots.push({
                name: counter.name,
                type: 'counter',
                description: counter.description,
                values: counter.getValues(),
            });
        }
        for (const gauge of this.gauges.values()) {
            snapshots.push({
                name: gauge.name,
                type: 'gauge',
                description: gauge.description,
                values: gauge.getValues(),
            });
        }
        for (const histogram of this.histograms.values()) {
            snapshots.push({
                name: histogram.name,
                type: 'histogram',
                description: histogram.description,
                values: histogram.getValues(),
            });
        }
        return snapshots;
    }
    resetAll() {
        for (const c of this.counters.values())
            c.reset();
        for (const g of this.gauges.values())
            g.reset();
        for (const h of this.histograms.values())
            h.reset();
    }
    assertNoConflict(name, requestedType) {
        if (this.counters.has(name) && requestedType !== 'counter') {
            throw new Error(`Metric "${name}" is already registered as a counter.`);
        }
        if (this.gauges.has(name) && requestedType !== 'gauge') {
            throw new Error(`Metric "${name}" is already registered as a gauge.`);
        }
        if (this.histograms.has(name) && requestedType !== 'histogram') {
            throw new Error(`Metric "${name}" is already registered as a histogram.`);
        }
    }
}
//# sourceMappingURL=metrics.js.map