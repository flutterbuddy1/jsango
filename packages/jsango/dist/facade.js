import { HttpResponse, HttpStatus, BadRequestError, UnauthorizedError, ForbiddenError, NotFoundError, InternalServerError, } from '@jsango/http';
import { EventBus } from '@jsango/events';
import { QueueManager } from '@jsango/queue';
import { CacheManager } from '@jsango/cache';
// --- Error Factories (throwable helpers) ---
export function badRequest(message = 'Bad Request', details) {
    const err = new BadRequestError({ message });
    if (details !== undefined) {
        err.details = details;
    }
    return err;
}
export function unauthorized(message = 'Unauthorized') {
    return new UnauthorizedError({ message });
}
export function forbidden(message = 'Forbidden') {
    return new ForbiddenError({ message });
}
export function notFound(message = 'Not Found') {
    return new NotFoundError({ message });
}
export function serverError(message = 'Internal Server Error') {
    return new InternalServerError({ message });
}
// --- Response Shortcut Namespace ---
export const response = {
    json: (data, status = HttpStatus.OK, headers) => HttpResponse.json(data, { status, headers }),
    created: (data, headers) => HttpResponse.created(data, { headers }),
    noContent: () => HttpResponse.noContent(),
    text: (text, status = HttpStatus.OK) => HttpResponse.text(text, { status }),
    html: (html, status = HttpStatus.OK) => HttpResponse.html(html, { status }),
    redirect: (url, status = HttpStatus.FOUND) => HttpResponse.redirect(url, status),
    badRequest: (message = 'Bad Request', details) => HttpResponse.badRequest(message, 'ERR_BAD_REQUEST', details),
    unauthorized: (message = 'Unauthorized') => HttpResponse.unauthorized(message),
    forbidden: (message = 'Forbidden') => HttpResponse.forbidden(message),
    notFound: (message = 'Not Found') => HttpResponse.notFound(message),
    serverError: (message = 'Internal Server Error') => HttpResponse.serverError(message),
};
// --- Events Singleton ---
export class SimpleEventFacade {
    bus = new EventBus();
    on(eventName, handler) {
        this.bus.on(eventName, async (event) => {
            await handler(event?.payload);
        });
        return this;
    }
    async emit(eventName, payload) {
        await this.bus.emit({ type: eventName, payload });
    }
}
export const events = new SimpleEventFacade();
// --- Background Jobs Singleton ---
export class SimpleJobFacade {
    manager = new QueueManager();
    worker;
    register(name, handler) {
        this.manager.registerJob({
            type: name,
            handler: async (ctx) => {
                await handler(ctx.payload);
            },
        });
        return this;
    }
    async dispatch(name, payload, options) {
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
    manager = new CacheManager();
    async get(key) {
        const val = await this.manager.get(key);
        return val !== undefined ? val : null;
    }
    async set(key, value, ttlSeconds) {
        await this.manager.set(key, value, ttlSeconds !== undefined ? { ttlMs: ttlSeconds * 1000 } : undefined);
    }
    async delete(key) {
        return this.manager.delete(key);
    }
    async remember(key, ttlSeconds, factory) {
        const cached = await this.get(key);
        if (cached !== null && cached !== undefined) {
            return cached;
        }
        const fresh = await factory();
        await this.set(key, fresh, ttlSeconds);
        return fresh;
    }
}
export const cache = new SimpleCacheFacade();
//# sourceMappingURL=facade.js.map