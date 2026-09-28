import {
  HttpResponse,
  HttpStatus,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  InternalServerError,
} from '@jsango/http';
import { EventBus } from '@jsango/events';
import { QueueManager, Worker, type JobContext } from '@jsango/queue';
import { CacheManager } from '@jsango/cache';

// --- Error Factories (throwable helpers) ---

export function badRequest(message = 'Bad Request', details?: unknown): BadRequestError {
  const err = new BadRequestError({ message });
  if (details !== undefined) {
    (err as unknown as { details: unknown }).details = details;
  }
  return err;
}

export function unauthorized(message = 'Unauthorized'): UnauthorizedError {
  return new UnauthorizedError({ message });
}

export function forbidden(message = 'Forbidden'): ForbiddenError {
  return new ForbiddenError({ message });
}

export function notFound(message = 'Not Found'): NotFoundError {
  return new NotFoundError({ message });
}

export function serverError(message = 'Internal Server Error'): InternalServerError {
  return new InternalServerError({ message });
}

// --- Response Shortcut Namespace ---

export const response = {
  json: (data: unknown, status = HttpStatus.OK, headers?: Record<string, string>) =>
    HttpResponse.json(data, { status, headers }),
  created: (data: unknown, headers?: Record<string, string>) =>
    HttpResponse.created(data, { headers }),
  noContent: () => HttpResponse.noContent(),
  text: (text: string, status = HttpStatus.OK) => HttpResponse.text(text, { status }),
  html: (html: string, status = HttpStatus.OK) => HttpResponse.html(html, { status }),
  redirect: (url: string, status = HttpStatus.FOUND) => HttpResponse.redirect(url, status),
  badRequest: (message = 'Bad Request', details?: unknown) =>
    HttpResponse.badRequest(message, 'ERR_BAD_REQUEST', details),
  unauthorized: (message = 'Unauthorized') => HttpResponse.unauthorized(message),
  forbidden: (message = 'Forbidden') => HttpResponse.forbidden(message),
  notFound: (message = 'Not Found') => HttpResponse.notFound(message),
  serverError: (message = 'Internal Server Error') => HttpResponse.serverError(message),
};

// --- Events Singleton ---

export class SimpleEventFacade {
  private readonly bus = new EventBus();

  public on<T = unknown>(eventName: string, handler: (payload: T) => void | Promise<void>): this {
    this.bus.on(eventName, async (event: any) => {
      await handler(event?.payload as T);
    });
    return this;
  }

  public async emit(eventName: string, payload: unknown): Promise<void> {
    await this.bus.emit({ type: eventName, payload });
  }
}

export const events = new SimpleEventFacade();

// --- Background Jobs Singleton ---

export class SimpleJobFacade {
  private readonly manager = new QueueManager();
  private worker?: Worker;

  public register<T = unknown>(name: string, handler: (payload: T) => Promise<void> | void): this {
    this.manager.registerJob({
      type: name,
      handler: async (ctx: JobContext<T>) => {
        await handler(ctx.payload);
      },
    });
    return this;
  }

  public async dispatch<T = unknown>(
    name: string,
    payload: T,
    options?: { delay?: number; maxAttempts?: number }
  ): Promise<string> {
    const id = await this.manager.dispatch(name, payload, {
      delayMs: options?.delay,
      maxAttempts: options?.maxAttempts,
    });
    if (!this.worker) {
      this.worker = this.manager.createWorker();
    }
    await this.worker.runOnce();
    return id;
  }
}

export const jobs = new SimpleJobFacade();

// --- Cache Singleton ---

export class SimpleCacheFacade {
  private readonly manager = new CacheManager();

  public async get<T = unknown>(key: string): Promise<T | null> {
    const val = await this.manager.get<T>(key);
    return val !== undefined ? val : null;
  }

  public async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    await this.manager.set(
      key,
      value,
      ttlSeconds !== undefined ? { ttlMs: ttlSeconds * 1000 } : undefined
    );
  }

  public async delete(key: string): Promise<boolean> {
    return this.manager.delete(key);
  }

  public async remember<T>(key: string, ttlSeconds: number, factory: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null && cached !== undefined) {
      return cached;
    }
    const fresh = await factory();
    await this.set(key, fresh, ttlSeconds);
    return fresh;
  }
}

export const cache = new SimpleCacheFacade();
