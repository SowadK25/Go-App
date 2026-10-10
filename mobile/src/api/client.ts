export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly retryAfter?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function getApiUrl(): string {
  const value = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, '');
  if (!value)
    throw new ApiError('Set EXPO_PUBLIC_API_URL in mobile/.env.local, then restart Expo.');
  try {
    const url = new URL(value);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      throw new Error();
    }
    return value;
  } catch {
    throw new ApiError(
      'EXPO_PUBLIC_API_URL must be an HTTP or HTTPS address without credentials, a query, or a fragment.',
    );
  }
}

export async function request<T>(path: string, signal?: AbortSignal): Promise<T> {
  const base = getApiUrl();
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', abort);
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 15000);
  try {
    const response = await fetch(`${base}${path}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = body && typeof body === 'object' && 'detail' in body ? body.detail : null;
      const retryHeader = response.headers.get('Retry-After');
      const seconds = retryHeader ? Number(retryHeader) : NaN;
      throw new ApiError(
        typeof detail === 'string'
          ? detail
          : `Request failed (${response.status}). Please try again.`,
        response.status,
        Number.isFinite(seconds) ? seconds : undefined,
      );
    }
    if (body === null)
      throw new ApiError('The API returned an empty or invalid response.', response.status);
    return body as T;
  } catch (error) {
    if (error instanceof ApiError || signal?.aborted) throw error;
    throw new ApiError(
      timedOut
        ? 'The request timed out. Please try again.'
        : 'Cannot reach the API. Check your connection and API address.',
    );
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}
