import { HttpResponse, BadRequestError, UnauthorizedError, ForbiddenError, NotFoundError, InternalServerError } from '@jsango/http';
export declare function badRequest(message?: string, details?: unknown): BadRequestError;
export declare function unauthorized(message?: string): UnauthorizedError;
export declare function forbidden(message?: string): ForbiddenError;
export declare function notFound(message?: string): NotFoundError;
export declare function serverError(message?: string): InternalServerError;
export declare const response: {
    json: (data: unknown, status?: 200, headers?: Record<string, string>) => HttpResponse;
    created: (data: unknown, headers?: Record<string, string>) => HttpResponse;
    noContent: () => HttpResponse;
    text: (text: string, status?: 200) => HttpResponse;
    html: (html: string, status?: 200) => HttpResponse;
    redirect: (url: string, status?: 302) => HttpResponse;
    badRequest: (message?: string, details?: unknown) => HttpResponse;
    unauthorized: (message?: string) => HttpResponse;
    forbidden: (message?: string) => HttpResponse;
    notFound: (message?: string) => HttpResponse;
    serverError: (message?: string) => HttpResponse;
};
export declare class SimpleEventFacade {
    private readonly bus;
    on<T = unknown>(eventName: string, handler: (payload: T) => void | Promise<void>): this;
    emit(eventName: string, payload: unknown): Promise<void>;
}
export declare const events: SimpleEventFacade;
export declare class SimpleJobFacade {
    private readonly manager;
    private worker?;
    register<T = unknown>(name: string, handler: (payload: T) => Promise<void> | void): this;
    dispatch<T = unknown>(name: string, payload: T, options?: {
        delay?: number;
        maxAttempts?: number;
    }): Promise<string>;
}
export declare const jobs: SimpleJobFacade;
export declare class SimpleCacheFacade {
    private readonly manager;
    get<T = unknown>(key: string): Promise<T | null>;
    set(key: string, value: unknown, ttlSeconds?: number): Promise<void>;
    delete(key: string): Promise<boolean>;
    remember<T>(key: string, ttlSeconds: number, factory: () => Promise<T>): Promise<T>;
}
export declare const cache: SimpleCacheFacade;
//# sourceMappingURL=facade.d.ts.map