import * as crypto from 'node:crypto';
import { Base64Url } from '../../internal/base64url.js';
import { AuthenticationError } from '../errors.js';

/** Normalized user profile returned by every OAuth provider. */
export interface OAuthProfile {
  readonly provider: string;
  /** Stable id of the user at the provider (store it to link accounts). */
  readonly id: string;
  readonly email?: string | undefined;
  /** True only when the provider says the address is verified. Never link accounts on unverified email. */
  readonly emailVerified: boolean;
  readonly name?: string | undefined;
  readonly avatarUrl?: string | undefined;
  readonly accessToken: string;
  readonly raw: Readonly<Record<string, unknown>>;
}

export interface OAuthProvider {
  readonly name: string;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly authorizeUrl: string;
  readonly tokenUrl: string;
  readonly scopes: readonly string[];
  /** Absolute callback URL registered with the provider, e.g. https://api.example.com/auth/google/callback */
  readonly redirectUri: string;
  /** Extra query parameters for the authorize URL (e.g. `{ prompt: 'select_account' }`). */
  readonly authorizeParams?: Readonly<Record<string, string>> | undefined;
  /** Loads the user's profile with the provider access token. */
  profile(
    accessToken: string,
    tokens: Readonly<Record<string, unknown>>,
    fetchFn: typeof fetch
  ): Promise<Omit<OAuthProfile, 'provider' | 'accessToken'>>;
}

type ProviderCredentials = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes?: readonly string[];
};

async function getJson(
  fetchFn: typeof fetch,
  url: string,
  accessToken: string
): Promise<Record<string, unknown>> {
  const res = await fetchFn(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'User-Agent': 'jsango',
    },
  });
  if (!res.ok) throw new Error(`${url} returned HTTP ${res.status}`);
  return (await res.json()) as Record<string, unknown>;
}

/** Sign in with Google (OpenID Connect). */
export function google(options: ProviderCredentials): OAuthProvider {
  return {
    name: 'google',
    ...options,
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: options.scopes ?? ['openid', 'email', 'profile'],
    async profile(accessToken, _tokens, fetchFn) {
      const u = await getJson(
        fetchFn,
        'https://openidconnect.googleapis.com/v1/userinfo',
        accessToken
      );
      return {
        id: String(u['sub']),
        email: u['email'] as string | undefined,
        emailVerified: u['email_verified'] === true,
        name: u['name'] as string | undefined,
        avatarUrl: u['picture'] as string | undefined,
        raw: u,
      };
    },
  };
}

/** Sign in with GitHub. */
export function github(options: ProviderCredentials): OAuthProvider {
  return {
    name: 'github',
    ...options,
    authorizeUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    scopes: options.scopes ?? ['read:user', 'user:email'],
    async profile(accessToken, _tokens, fetchFn) {
      const u = await getJson(fetchFn, 'https://api.github.com/user', accessToken);
      // The public profile email may be empty or unverified; use the verified primary address.
      let email: string | undefined;
      let verified = false;
      try {
        const res = await fetchFn('https://api.github.com/user/emails', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
            'User-Agent': 'jsango',
          },
        });
        if (res.ok) {
          const emails = (await res.json()) as Array<{
            email: string;
            primary: boolean;
            verified: boolean;
          }>;
          const primary = emails.find((e) => e.primary) ?? emails.find((e) => e.verified);
          if (primary) {
            email = primary.email;
            verified = primary.verified;
          }
        }
      } catch {
        // scope not granted: fall back to the public profile
      }
      return {
        id: String(u['id']),
        email: email ?? (u['email'] as string | undefined),
        emailVerified: verified,
        name: (u['name'] as string | undefined) ?? (u['login'] as string | undefined),
        avatarUrl: u['avatar_url'] as string | undefined,
        raw: u,
      };
    },
  };
}

/**
 * Any OAuth 2.0 / OpenID Connect provider (Microsoft, GitLab, Discord, Keycloak, ...).
 * `userInfoUrl` must return JSON; map it with `mapProfile` when the fields are not OIDC-standard.
 */
export function oauthProvider(
  options: ProviderCredentials & {
    name: string;
    authorizeUrl: string;
    tokenUrl: string;
    userInfoUrl: string;
    authorizeParams?: Record<string, string>;
    mapProfile?: (
      userInfo: Record<string, unknown>
    ) => Omit<OAuthProfile, 'provider' | 'accessToken' | 'raw'>;
  }
): OAuthProvider {
  return {
    ...options,
    scopes: options.scopes ?? ['openid', 'email', 'profile'],
    async profile(accessToken, _tokens, fetchFn) {
      const u = await getJson(fetchFn, options.userInfoUrl, accessToken);
      const mapped = options.mapProfile?.(u) ?? {
        id: String(u['sub'] ?? u['id']),
        email: u['email'] as string | undefined,
        emailVerified: u['email_verified'] === true,
        name: u['name'] as string | undefined,
        avatarUrl: u['picture'] as string | undefined,
      };
      return { ...mapped, raw: u };
    },
  };
}

export const OAUTH_COOKIE = 'jsango_oauth';

export class OAuthError extends AuthenticationError {
  public constructor(message: string) {
    super({ code: 'ERR_AUTH_OAUTH', message, statusCode: 400 });
  }
}

/** Creates the authorize URL plus the state that must be stored in a signed cookie. */
export function buildAuthorizeRequest(provider: OAuthProvider): {
  url: string;
  state: string;
  verifier: string;
} {
  const state = Base64Url.encode(crypto.randomBytes(24));
  const verifier = Base64Url.encode(crypto.randomBytes(32));
  const challenge = Base64Url.encode(crypto.createHash('sha256').update(verifier).digest());
  const url = new URL(provider.authorizeUrl);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', provider.clientId);
  url.searchParams.set('redirect_uri', provider.redirectUri);
  url.searchParams.set('scope', provider.scopes.join(' '));
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  for (const [k, v] of Object.entries(provider.authorizeParams ?? {})) url.searchParams.set(k, v);
  return { url: url.toString(), state, verifier };
}

/** Exchanges the authorization code (with the PKCE verifier) and loads the profile. */
export async function completeAuthorization(
  provider: OAuthProvider,
  code: string,
  verifier: string,
  fetchFn: typeof fetch
): Promise<OAuthProfile> {
  const res = await fetchFn(provider.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: provider.redirectUri,
      client_id: provider.clientId,
      client_secret: provider.clientSecret,
      code_verifier: verifier,
    }).toString(),
  });
  const tokens = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const accessToken = tokens['access_token'];
  if (!res.ok || typeof accessToken !== 'string') {
    throw new OAuthError(
      `${provider.name} rejected the authorization code${tokens['error'] ? `: ${String(tokens['error'])}` : ''}.`
    );
  }
  try {
    const profile = await provider.profile(accessToken, tokens, fetchFn);
    // A missing id would become the string "undefined" and sign every user into one account.
    if (!profile.id || profile.id === 'undefined' || profile.id === 'null') {
      throw new Error('the profile has no user id');
    }
    return { ...profile, provider: provider.name, accessToken };
  } catch (err) {
    throw new OAuthError(
      `Could not load the ${provider.name} profile: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}
