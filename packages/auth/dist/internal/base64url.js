export class Base64Url {
    static encode(input) {
        const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
        return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    }
    static decode(input) {
        let base64 = input.replace(/-/g, '+').replace(/_/g, '/');
        while (base64.length % 4 !== 0) {
            base64 += '=';
        }
        return Buffer.from(base64, 'base64').toString('utf8');
    }
    static decodeToBuffer(input) {
        let base64 = input.replace(/-/g, '+').replace(/_/g, '/');
        while (base64.length % 4 !== 0) {
            base64 += '=';
        }
        return Buffer.from(base64, 'base64');
    }
}
//# sourceMappingURL=base64url.js.map