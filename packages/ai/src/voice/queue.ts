/** A push-based async iterable: producers `push`, one consumer `for await`s. */
export class AsyncQueue<T> implements AsyncIterable<T> {
  private readonly items: T[] = [];
  private wake: (() => void) | undefined;
  private ended = false;

  public push(item: T): void {
    if (this.ended) return;
    this.items.push(item);
    this.wake?.();
  }

  public end(): void {
    this.ended = true;
    this.wake?.();
  }

  public async *[Symbol.asyncIterator](): AsyncIterator<T> {
    while (true) {
      while (this.items.length > 0) yield this.items.shift()!;
      if (this.ended) return;
      await new Promise<void>((resolve) => (this.wake = resolve));
      this.wake = undefined;
    }
  }
}
