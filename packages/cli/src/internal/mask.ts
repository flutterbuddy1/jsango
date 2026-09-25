const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /api[_-]?key/i,
  /auth/i,
  /cert/i,
  /private[_-]?key/i,
  /hash/i,
  /salt/i,
  /credential/i,
  /jwt/i,
  /dsn/i,
  /database[_-]?url/i,
];

const URL_PASSWORD_REGEX = /(:\/\/[^:]+:)([^@]+)(@)/;

export class MaskUtil {
  public static isSensitiveKey(key: string): boolean {
    return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
  }

  public static maskValue(value: unknown, key?: string): unknown {
    if (value === null || value === undefined) {
      return value;
    }

    if (key && MaskUtil.isSensitiveKey(key)) {
      return '********';
    }

    if (typeof value === 'string') {
      // Check if it's a connection string with embedded password (e.g. postgres://user:secret@localhost:5432/db)
      if (URL_PASSWORD_REGEX.test(value)) {
        return value.replace(URL_PASSWORD_REGEX, '$1********$3');
      }
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((item) => MaskUtil.maskValue(item, key));
    }

    if (typeof value === 'object') {
      const maskedObj: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        maskedObj[k] = MaskUtil.isSensitiveKey(k) ? '********' : MaskUtil.maskValue(v, k);
      }
      return maskedObj;
    }

    return value;
  }
}
