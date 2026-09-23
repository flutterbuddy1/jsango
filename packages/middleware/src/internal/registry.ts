import type { Middleware, MiddlewareDefinition } from '../public/types.js';
import { NamedMiddlewareNotFoundError } from '../public/errors.js';

export class MiddlewareRegistry {
  private readonly named = new Map<string, Middleware>();

  public register(name: string, middleware: Middleware): void {
    this.named.set(name, middleware);
  }

  public has(name: string): boolean {
    return this.named.has(name);
  }

  public get(name: string): Middleware | undefined {
    return this.named.get(name);
  }

  public resolve(def: MiddlewareDefinition): Middleware {
    if (typeof def === 'string') {
      const mw = this.named.get(def);
      if (!mw) {
        throw new NamedMiddlewareNotFoundError(def);
      }
      return mw;
    }
    return def;
  }

  public resolveAll(definitions: readonly MiddlewareDefinition[]): Middleware[] {
    return definitions.map((def) => this.resolve(def));
  }
}
