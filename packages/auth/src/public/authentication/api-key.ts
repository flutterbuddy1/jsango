import type { HttpRequest, RequestContext } from '@jsango/http';
import { CryptoUtils } from '../../internal/crypto-utils.js';
import { AnonymousIdentity } from '../identity.js';
import type { AuthenticationResult, IAuthenticationStrategy, Identity } from '../types.js';

export interface IApiKeyVerifier {
  verifyApiKey(hashedKey: string, rawKey: string): Promise<Identity | undefined>;
}

export interface ApiKeyAuthStrategyOptions {
  readonly verifier: IApiKeyVerifier;
  readonly headerName?: string | undefined; // default: x-api-key
}

export class ApiKeyAuthenticationStrategy implements IAuthenticationStrategy {
  public readonly name = 'api_key';
  public readonly verifier: IApiKeyVerifier;
  public readonly headerName: string;

  public constructor(options: ApiKeyAuthStrategyOptions) {
    this.verifier = options.verifier;
    this.headerName = (options.headerName ?? 'x-api-key').toLowerCase();
  }

  public async authenticate(
    request: HttpRequest,
    _context: RequestContext
  ): Promise<AuthenticationResult> {
    let rawKey = request.headers.get(this.headerName);

    // Also check Authorization: ApiKey <key>
    if (!rawKey) {
      const authHeader = request.headers.get('authorization');
      if (authHeader) {
        const match = /^ApiKey\s+(.+)$/i.exec(authHeader);
        if (match && match[1]) {
          rawKey = match[1].trim();
        }
      }
    }

    if (!rawKey) {
      return {
        status: 'unauthenticated',
        identity: new AnonymousIdentity(),
        strategy: this.name,
      };
    }

    const hashedKey = CryptoUtils.sha256(rawKey);

    try {
      const identity = await this.verifier.verifyApiKey(hashedKey, rawKey);
      if (!identity) {
        return {
          status: 'invalid_credentials',
          identity: new AnonymousIdentity(),
          strategy: this.name,
        };
      }

      return {
        status: 'authenticated',
        identity,
        strategy: this.name,
        metadata: { hashedKeyPrefix: hashedKey.slice(0, 8) },
      };
    } catch (err) {
      return {
        status: 'invalid_credentials',
        identity: new AnonymousIdentity(),
        strategy: this.name,
        error: err instanceof Error ? err : new Error(String(err)),
      };
    }
  }
}
