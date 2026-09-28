export class HttpQuery {
    params = new Map();
    constructor(searchParamsOrString) {
        if (searchParamsOrString instanceof URLSearchParams) {
            for (const [key, value] of searchParamsOrString.entries()) {
                this.append(key, value);
            }
        }
        else if (typeof searchParamsOrString === 'string') {
            const search = searchParamsOrString.startsWith('?')
                ? searchParamsOrString.slice(1)
                : searchParamsOrString;
            const parsed = new URLSearchParams(search);
            for (const [key, value] of parsed.entries()) {
                this.append(key, value);
            }
        }
        else if (searchParamsOrString && typeof searchParamsOrString === 'object') {
            for (const [key, val] of Object.entries(searchParamsOrString)) {
                if (typeof val === 'undefined')
                    continue;
                if (Array.isArray(val)) {
                    for (const item of val) {
                        this.append(key, String(item));
                    }
                }
                else {
                    this.set(key, String(val));
                }
            }
        }
    }
    get(name) {
        const list = this.params.get(name);
        if (!list || list.length === 0)
            return null;
        return list[0] ?? null;
    }
    getAll(name) {
        const list = this.params.get(name);
        return list ? Object.freeze([...list]) : [];
    }
    has(name) {
        return this.params.has(name);
    }
    set(name, value) {
        this.params.set(name, [value]);
    }
    append(name, value) {
        const existing = this.params.get(name);
        if (existing) {
            existing.push(value);
        }
        else {
            this.params.set(name, [value]);
        }
    }
    delete(name) {
        this.params.delete(name);
    }
    *entries() {
        for (const [key, values] of this.params.entries()) {
            yield [key, Object.freeze([...values])];
        }
    }
    toRecord() {
        const record = {};
        for (const [key, values] of this.params.entries()) {
            if (values.length === 1) {
                record[key] = values[0];
            }
            else {
                record[key] = Object.freeze([...values]);
            }
        }
        return record;
    }
    toString() {
        const sp = new URLSearchParams();
        for (const [key, values] of this.params.entries()) {
            for (const val of values) {
                sp.append(key, val);
            }
        }
        return sp.toString();
    }
}
//# sourceMappingURL=query.js.map