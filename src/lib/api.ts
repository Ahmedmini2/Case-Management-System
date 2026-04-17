export type ApiResponse<T> = {
  data: T | null;
  error: string | null;
  meta: Record<string, unknown> | null;
};

export function ok<T>(data: T, meta: Record<string, unknown> | null = null): ApiResponse<T> {
  return { data, error: null, meta };
}

export function fail(message: string, meta: Record<string, unknown> | null = null): ApiResponse<null> {
  return { data: null, error: message, meta };
}
