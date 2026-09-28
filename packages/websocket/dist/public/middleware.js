export class WebSocketMiddlewarePipeline {
    middlewares = [];
    use(...handlers) {
        this.middlewares.push(...handlers);
        return this;
    }
    async execute(ctx, message, target) {
        let index = 0;
        const next = async () => {
            if (index < this.middlewares.length) {
                const current = this.middlewares[index++];
                if (current) {
                    await current(ctx, message, next);
                }
            }
            else {
                await target();
            }
        };
        await next();
    }
}
//# sourceMappingURL=middleware.js.map