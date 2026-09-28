import { EventError } from './errors.js';
/**
 * Onion-style event middleware pipeline.
 * Separate from HTTP middleware and Queue middleware.
 */
export class EventMiddlewarePipeline {
    handlers = [];
    constructor(handlers = []) {
        this.handlers = [...handlers];
    }
    use(...handlers) {
        this.handlers.push(...handlers);
        return this;
    }
    async execute(event, terminal) {
        let index = -1;
        const dispatch = async (i) => {
            if (i <= index) {
                throw new EventError({
                    code: 'ERR_EVENT_MIDDLEWARE_MULTIPLE_NEXT',
                    message: 'next() was called multiple times in event middleware.',
                    statusCode: 500,
                });
            }
            index = i;
            if (i === this.handlers.length) {
                return terminal();
            }
            const handler = this.handlers[i];
            if (!handler) {
                return terminal();
            }
            return handler(event, () => dispatch(i + 1));
        };
        return dispatch(0);
    }
    get length() {
        return this.handlers.length;
    }
}
//# sourceMappingURL=middleware.js.map