import { randomUUID } from 'node:crypto';

const SAFE_REQUEST_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

export class CorrelationManager {
  /**
   * Returns a sanitized request ID from an untrusted client header, or generates a fresh UUID.
   */
  public static resolveRequestId(rawHeader?: string | undefined): string {
    if (rawHeader && SAFE_REQUEST_ID_REGEX.test(rawHeader.trim())) {
      return rawHeader.trim();
    }
    return randomUUID();
  }

  /**
   * Generates a 32-character hexadecimal trace ID.
   */
  public static generateTraceId(): string {
    return randomUUID().replace(/-/g, '');
  }

  /**
   * Generates a 16-character hexadecimal span ID.
   */
  public static generateSpanId(): string {
    return randomUUID().replace(/-/g, '').slice(0, 16);
  }

  /**
   * Parses standard W3C traceparent header (format: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01).
   */
  public static parseTraceparent(
    header?: string | undefined
  ): { traceId: string; parentSpanId: string; sampled: boolean } | undefined {
    if (!header) return undefined;
    const parts = header.trim().split('-');
    if (parts.length !== 4) return undefined;
    const [version, traceId, parentSpanId, flags] = parts;
    if (version !== '00') return undefined;
    if (traceId && traceId.length !== 32) return undefined;
    if (parentSpanId && parentSpanId.length !== 16) return undefined;

    return {
      traceId: traceId!,
      parentSpanId: parentSpanId!,
      sampled: flags === '01',
    };
  }

  /**
   * Formats a W3C traceparent header.
   */
  public static formatTraceparent(traceId: string, spanId: string, sampled = true): string {
    return `00-${traceId}-${spanId}-${sampled ? '01' : '00'}`;
  }
}
