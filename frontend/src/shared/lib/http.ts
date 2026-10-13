import { ApiError, type ApiErrorCode } from './errors';
import { readToken, requireClaims } from './session';

/** Base URL of the API Gateway stage, e.g. https://abc123.execute-api.us-east-1.amazonaws.com/dev */
const BASE_URL = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').replace(/\/+$/, '');

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
}

function isKnownCode(value: unknown): value is ApiErrorCode {
  return typeof value === 'string' && (KNOWN_CODES as readonly string[]).includes(value);
}

function buildUrl(path: string, query: RequestOptions['query']): string {
  const params = new URLSearchParams();
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined) params.set(key, String(value));
  });
  const qs = params.toString();
  return `${BASE_URL}${path}${qs ? `?${qs}` : ''}`;
}

/**
 * Single entry point to the backend. Throws `ApiError` with the codes the UI already handles:
 * the Flask API answers `{ code, message }` with the same code names.
 */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, auth = true } = options;
  if (auth) requireClaims(); // missing or expired token: fail fast without a round trip
  if (!BASE_URL) throw new ApiError('INTERNAL', 'API URL is not configured (set VITE_API_URL)');

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = auth ? readToken() : null;
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
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
