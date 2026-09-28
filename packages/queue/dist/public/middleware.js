import { QueueError } from './errors.js';
/**
 * Onion-style execution pipeline for queue jobs.
 */
export class QueueMiddlewarePipeline {
    handlers = [];
    constructor(handlers = []) {
        this.handlers = [...handlers];
    }
    use(...handlers) {
        this.handlers.push(...handlers);
        return this;
    }
    async execute(context, terminal) {
        let index = -1;
        const dispatch = async (i) => {
            if (i <= index) {
                throw new QueueError({
                    code: 'ERR_QUEUE_MIDDLEWARE_MULTIPLE_NEXT',
                    message: 'next() was called multiple times in queue middleware.',
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
            return handler(context, () => dispatch(i + 1));
        };
        return dispatch(0);
    }
}
//# sourceMappingURL=middleware.js.map