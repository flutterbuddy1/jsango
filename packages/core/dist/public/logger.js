export class NoopLogger {
    debug(_message, _context) { }
    info(_message, _context) { }
    warn(_message, _context) { }
    error(_message, _context) { }
    child(_bindings) {
        return this;
    }
}
//# sourceMappingURL=logger.js.map