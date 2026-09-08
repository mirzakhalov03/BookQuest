import type { ApiResponse } from '@bookquest/shared';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api/v1';

/**
 * Thrown for any non-successful response. It carries the per-field messages
 * the API returns, so a form can drop them straight onto its inputs.
 */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: Record<string, string>;

  constructor(status: number, code: string, message: string, fields: Record<string, string> = {}) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers, ...rest } = options;

  const response = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...headers
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });

  const payload = (await response.json().catch(() => null)) as ApiResponse<T> | null;

  if (!payload) {
    throw new ApiRequestError(response.status, 'internal_error', 'The server sent no answer.');
  }
  if (!payload.ok) {
    throw new ApiRequestError(
      response.status,
      payload.error.code,
      payload.error.message,
      payload.error.fields ?? {}
    );
  }

  return payload.data;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body })
};
