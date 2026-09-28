import { MultipleNextCallsError } from '../public/errors.js';
import { ResponseNormalizer } from './normalizer.js';
export class MiddlewarePipeline {
    stack = [];
    constructor(middlewares = []) {
        this.stack.push(...middlewares);
    }
    use(...middleware) {
        this.stack.push(...middleware);
        return this;
    }
    get length() {
        return this.stack.length;
    }
    async execute(ctx, terminalHandler) {
        let prevIndex = -1;
        const dispatch = async (i) => {
            if (i <= prevIndex) {
                throw new MultipleNextCallsError();
            }
            prevIndex = i;
            if (i === this.stack.length) {
                return terminalHandler(ctx);
            }
            const mw = this.stack[i];
            const next = async () => {
                return dispatch(i + 1);
            };
            let result;
            if (typeof mw === 'function') {
                result = await mw(ctx, next);
            }
            else {
                result = await mw.handle(ctx, next);
            }
            return ResponseNormalizer.normalize(result, ctx);
        };
        return dispatch(0);
    }
}
//# sourceMappingURL=pipeline.js.map