const baseUrl =
  process.env.NODE_ENV === 'production'
    ? ''
    : 'http://localhost:4000';

export interface ApiResponse {
  success: boolean;
  message: string;
  data?: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const baseAPI = async (
  url: string,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  body?: unknown,
): Promise<ApiResponse> => {
  try {
    const res = await fetch(`${baseUrl}/user${url}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: method !== 'GET' && body ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    let data: unknown;

    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      throw new Error('Invalid JSON response from server');
    }

    if (!isRecord(data) || typeof data.success !== 'boolean') {
      throw new Error('Invalid response from server');
    }

    const responseMessage =
      typeof data.message === 'string' && data.message
        ? data.message
        : undefined;

    if (!res.ok || !data.success) {
      return {
        success: false,
        message: responseMessage ?? `Request failed with status ${res.status}`,
      };
    }

    return {
      success: true,
      message: responseMessage ?? 'Request successful',
      data: data.data ?? data,
    };
  } catch (error) {
    const message =
      error instanceof TypeError
        ? 'Unable to connect to the server. Please try again.'
        : error instanceof Error
          ? error.message
          : 'Something went wrong. Please try again.';
    return {
      success: false,
      message,
    };
  }
};
