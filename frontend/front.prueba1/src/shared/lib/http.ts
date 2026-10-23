import { ApiError, type ApiErrorCode } from './errors';
import { readToken, requireClaims } from './session';

const trimUrl = (value: string | undefined) => (value ?? '').replace(/\/+$/, '');

/** Local Flask backend, e.g. http://127.0.0.1:5000 */
const BASE_URL = trimUrl(import.meta.env.VITE_API_URL as string | undefined);
/** API Gateway that fronts the AWS Lambdas (authorizer + cart), e.g. https://abc123.execute-api.us-east-1.amazonaws.com */
const LAMBDA_URL = trimUrl(import.meta.env.VITE_LAMBDA_URL as string | undefined);

const KNOWN_CODES: readonly ApiErrorCode[] = ['UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND', 'VALIDATION', 'CONFLICT', 'INTERNAL'];

const STATUS_TO_CODE: Record<number, ApiErrorCode> = {
  400: 'VALIDATION',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'VALIDATION',
};

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  /** false only for POST /auth/login */
  auth?: boolean;
  /** 'api' = local Flask backend (default), 'lambda' = AWS API Gateway with the Lambdas */
  target?: 'api' | 'lambda';
}

function isKnownCode(value: unknown): value is ApiErrorCode {
  return typeof value === 'string' && (KNOWN_CODES as readonly string[]).includes(value);
}

function buildUrl(base: string, path: string, query: RequestOptions['query']): string {
  const params = new URLSearchParams();
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined) params.set(key, String(value));
  });
  const qs = params.toString();
  return `${base}${path}${qs ? `?${qs}` : ''}`;
}

/**
 * Single entry point to the backend. Throws `ApiError` with the codes the UI already handles:
 * the Flask API answers `{ code, message }` with the same code names.
 */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, auth = true, target = 'api' } = options;
  const base = target === 'lambda' ? LAMBDA_URL : BASE_URL;
  if (auth) requireClaims(); // missing or expired token: fail fast without a round trip
  if (!base) {
    const name = target === 'lambda' ? 'VITE_LAMBDA_URL' : 'VITE_API_URL';
    throw new ApiError('INTERNAL', `API URL is not configured (set ${name})`);
  }

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = auth ? readToken() : null;
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(buildUrl(base, path, query), {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new ApiError('INTERNAL', 'Cannot reach the server. Check your connection and try again.');
  }

  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (response.ok) return data as T;

  const payload = (data && typeof data === 'object' ? data : {}) as { code?: unknown; message?: unknown };
  // API Gateway rejects a bad or expired token itself with { "message": "Unauthorized" | "Forbidden" } (no `code`).
  if (auth && !isKnownCode(payload.code) && (response.status === 401 || response.status === 403)) {
    throw new ApiError('UNAUTHORIZED', 'Session expired');
  }
  const code = isKnownCode(payload.code) ? payload.code : (STATUS_TO_CODE[response.status] ?? 'INTERNAL');
  const message = typeof payload.message === 'string' && payload.message ? payload.message : 'Unexpected error';
  throw new ApiError(code, message);
}
