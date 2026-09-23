export class HttpQuery {
  private readonly params = new Map<string, string[]>();

  constructor(
    searchParamsOrString?:
      URLSearchParams | string | Record<string, string | readonly string[] | undefined>
  ) {
    if (searchParamsOrString instanceof URLSearchParams) {
      for (const [key, value] of searchParamsOrString.entries()) {
        this.append(key, value);
      }
    } else if (typeof searchParamsOrString === 'string') {
      const search = searchParamsOrString.startsWith('?')
        ? searchParamsOrString.slice(1)
        : searchParamsOrString;
      const parsed = new URLSearchParams(search);
      for (const [key, value] of parsed.entries()) {
        this.append(key, value);
      }
    } else if (searchParamsOrString && typeof searchParamsOrString === 'object') {
      for (const [key, val] of Object.entries(searchParamsOrString)) {
        if (typeof val === 'undefined') continue;
        if (Array.isArray(val)) {
          for (const item of val) {
            this.append(key, String(item));
          }
        } else {
          this.set(key, String(val));
        }
      }
    }
  }

  public get(name: string): string | null {
    const list = this.params.get(name);
    if (!list || list.length === 0) return null;
    return list[0] ?? null;
  }

  public getAll(name: string): readonly string[] {
    const list = this.params.get(name);
    return list ? Object.freeze([...list]) : [];
  }

  public has(name: string): boolean {
    return this.params.has(name);
  }

  public set(name: string, value: string): void {
    this.params.set(name, [value]);
  }

  public append(name: string, value: string): void {
    const existing = this.params.get(name);
    if (existing) {
      existing.push(value);
    } else {
      this.params.set(name, [value]);
    }
  }

  public delete(name: string): void {
    this.params.delete(name);
  }

  public *entries(): IterableIterator<[string, readonly string[]]> {
    for (const [key, values] of this.params.entries()) {
      yield [key, Object.freeze([...values])];
    }
  }

  public toRecord(): Record<string, string | readonly string[]> {
    const record: Record<string, string | readonly string[]> = {};
    for (const [key, values] of this.params.entries()) {
      if (values.length === 1) {
        record[key] = values[0]!;
      } else {
        record[key] = Object.freeze([...values]);
      }
    }
    return record;
  }

  public toString(): string {
    const sp = new URLSearchParams();
    for (const [key, values] of this.params.entries()) {
      for (const val of values) {
        sp.append(key, val);
      }
    }
    return sp.toString();
  }
}
