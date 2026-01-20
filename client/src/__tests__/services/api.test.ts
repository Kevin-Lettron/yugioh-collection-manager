import axios, { AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import toast from 'react-hot-toast';

// Mock axios
jest.mock('axios', () => {
  const mockAxios = {
    create: jest.fn(() => mockAxios),
    interceptors: {
      request: {
        use: jest.fn(),
      },
      response: {
        use: jest.fn(),
      },
    },
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  };
  return mockAxios;
});

// Mock react-hot-toast
jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedToast = toast as jest.Mocked<typeof toast>;

describe('API Service', () => {
  let requestInterceptor: (config: InternalAxiosRequestConfig) => InternalAxiosRequestConfig;
  let requestErrorInterceptor: (error: AxiosError) => Promise<never>;
  let responseInterceptor: (response: AxiosResponse) => AxiosResponse;
  let responseErrorInterceptor: (error: AxiosError) => Promise<never>;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();

    // Reset window.location
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
    });

    // Capture the interceptors when api is imported
    mockedAxios.interceptors.request.use.mockImplementation(
      (onFulfilled, onRejected) => {
        requestInterceptor = onFulfilled as (
          config: InternalAxiosRequestConfig
        ) => InternalAxiosRequestConfig;
        requestErrorInterceptor = onRejected as (error: AxiosError) => Promise<never>;
        return 0;
      }
    );

    mockedAxios.interceptors.response.use.mockImplementation(
      (onFulfilled, onRejected) => {
        responseInterceptor = onFulfilled as (response: AxiosResponse) => AxiosResponse;
        responseErrorInterceptor = onRejected as (error: AxiosError) => Promise<never>;
        return 0;
      }
    );

    // Clear the module cache and re-import to get fresh interceptors
    jest.resetModules();
  });

  describe('API Instance Creation', () => {
    it('creates axios instance with correct base URL', async () => {
      await import('../../services/api');

      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: expect.stringContaining('/api'),
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });

    it('sets up request interceptor', async () => {
      await import('../../services/api');
      expect(mockedAxios.interceptors.request.use).toHaveBeenCalled();
    });

    it('sets up response interceptor', async () => {
      await import('../../services/api');
      expect(mockedAxios.interceptors.response.use).toHaveBeenCalled();
    });
  });

  describe('Request Interceptor', () => {
    beforeEach(async () => {
      await import('../../services/api');
    });

    it('adds Authorization header when token exists', () => {
      localStorage.setItem('token', 'test-jwt-token');

      const config: InternalAxiosRequestConfig = {
        headers: {} as any,
      } as InternalAxiosRequestConfig;

      const result = requestInterceptor(config);

      expect(result.headers.Authorization).toBe('Bearer test-jwt-token');
    });

    it('does not add Authorization header when token does not exist', () => {
      const config: InternalAxiosRequestConfig = {
        headers: {} as any,
      } as InternalAxiosRequestConfig;

      const result = requestInterceptor(config);

      expect(result.headers.Authorization).toBeUndefined();
    });

    it('preserves existing headers', () => {
      localStorage.setItem('token', 'test-token');

      const config: InternalAxiosRequestConfig = {
        headers: {
          'Custom-Header': 'custom-value',
        } as any,
      } as InternalAxiosRequestConfig;

      const result = requestInterceptor(config);

      expect(result.headers['Custom-Header']).toBe('custom-value');
      expect(result.headers.Authorization).toBe('Bearer test-token');
    });

    it('rejects on request error', async () => {
      const error = new Error('Request failed') as AxiosError;

      await expect(requestErrorInterceptor(error)).rejects.toEqual(error);
    });
  });

  describe('Response Interceptor', () => {
    beforeEach(async () => {
      await import('../../services/api');
    });

    it('passes through successful responses', () => {
      const response: AxiosResponse = {
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      const result = responseInterceptor(response);

      expect(result).toBe(response);
    });

    it('shows error toast on non-401 error with message', async () => {
      const error: AxiosError<{ error: string }> = {
        response: {
          data: { error: 'Custom error message' },
          status: 400,
          statusText: 'Bad Request',
          headers: {},
          config: {} as any,
        },
        isAxiosError: true,
        toJSON: () => ({}),
        name: 'AxiosError',
        message: 'Request failed',
        config: {} as any,
      } as AxiosError<{ error: string }>;

      await expect(responseErrorInterceptor(error)).rejects.toEqual(error);
      expect(mockedToast.error).toHaveBeenCalledWith('Custom error message');
    });

    it('shows default error message when no specific error', async () => {
      const error: AxiosError<{ error: string }> = {
        response: {
          data: {},
          status: 500,
          statusText: 'Internal Server Error',
          headers: {},
          config: {} as any,
        },
        isAxiosError: true,
        toJSON: () => ({}),
        name: 'AxiosError',
        message: 'Request failed',
        config: {} as any,
      } as AxiosError<{ error: string }>;

      await expect(responseErrorInterceptor(error)).rejects.toEqual(error);
      expect(mockedToast.error).toHaveBeenCalledWith('An error occurred');
    });
  });

  describe('401 Unauthorized Handling', () => {
    beforeEach(async () => {
      localStorage.setItem('token', 'old-token');
      localStorage.setItem('user', JSON.stringify({ id: 1 }));
      await import('../../services/api');
    });

    it('removes token on 401 error', async () => {
      const error: AxiosError<{ error: string }> = {
        response: {
          data: { error: 'Unauthorized' },
          status: 401,
          statusText: 'Unauthorized',
          headers: {},
          config: {} as any,
        },
        isAxiosError: true,
        toJSON: () => ({}),
        name: 'AxiosError',
        message: 'Unauthorized',
        config: {} as any,
      } as AxiosError<{ error: string }>;

      await expect(responseErrorInterceptor(error)).rejects.toEqual(error);

      expect(localStorage.getItem('token')).toBeNull();
    });

    it('removes user from localStorage on 401 error', async () => {
      const error: AxiosError<{ error: string }> = {
        response: {
          data: { error: 'Unauthorized' },
          status: 401,
          statusText: 'Unauthorized',
          headers: {},
          config: {} as any,
        },
        isAxiosError: true,
        toJSON: () => ({}),
        name: 'AxiosError',
        message: 'Unauthorized',
        config: {} as any,
      } as AxiosError<{ error: string }>;

      await expect(responseErrorInterceptor(error)).rejects.toEqual(error);

      expect(localStorage.getItem('user')).toBeNull();
    });

    it('redirects to login page on 401 error', async () => {
      const error: AxiosError<{ error: string }> = {
        response: {
          data: { error: 'Unauthorized' },
          status: 401,
          statusText: 'Unauthorized',
          headers: {},
          config: {} as any,
        },
        isAxiosError: true,
        toJSON: () => ({}),
        name: 'AxiosError',
        message: 'Unauthorized',
        config: {} as any,
      } as AxiosError<{ error: string }>;

      await expect(responseErrorInterceptor(error)).rejects.toEqual(error);

      expect(window.location.href).toBe('/login');
    });

    it('shows session expired toast on 401 error', async () => {
      const error: AxiosError<{ error: string }> = {
        response: {
          data: { error: 'Unauthorized' },
          status: 401,
          statusText: 'Unauthorized',
          headers: {},
          config: {} as any,
        },
        isAxiosError: true,
        toJSON: () => ({}),
        name: 'AxiosError',
        message: 'Unauthorized',
        config: {} as any,
      } as AxiosError<{ error: string }>;

      await expect(responseErrorInterceptor(error)).rejects.toEqual(error);

      expect(mockedToast.error).toHaveBeenCalledWith('Session expired. Please login again.');
    });
  });

  describe('Network Error Handling', () => {
    beforeEach(async () => {
      await import('../../services/api');
    });

    it('shows network error toast when no response', async () => {
      const error: AxiosError = {
        request: {},
        response: undefined,
        isAxiosError: true,
        toJSON: () => ({}),
        name: 'AxiosError',
        message: 'Network Error',
        config: {} as any,
      } as AxiosError;

      await expect(responseErrorInterceptor(error)).rejects.toEqual(error);

      expect(mockedToast.error).toHaveBeenCalledWith(
        'Network error. Please check your connection.'
      );
    });

    it('shows unexpected error toast when neither request nor response', async () => {
      const error: AxiosError = {
        request: undefined,
        response: undefined,
        isAxiosError: true,
        toJSON: () => ({}),
        name: 'AxiosError',
        message: 'Unknown Error',
        config: {} as any,
      } as AxiosError;

      await expect(responseErrorInterceptor(error)).rejects.toEqual(error);

      expect(mockedToast.error).toHaveBeenCalledWith('An unexpected error occurred.');
    });
  });

  describe('Error Status Codes', () => {
    beforeEach(async () => {
      await import('../../services/api');
    });

    it('handles 400 Bad Request', async () => {
      const error: AxiosError<{ error: string }> = {
        response: {
          data: { error: 'Validation failed' },
          status: 400,
          statusText: 'Bad Request',
          headers: {},
          config: {} as any,
        },
        isAxiosError: true,
        toJSON: () => ({}),
        name: 'AxiosError',
        message: 'Bad Request',
        config: {} as any,
      } as AxiosError<{ error: string }>;

      await expect(responseErrorInterceptor(error)).rejects.toEqual(error);
      expect(mockedToast.error).toHaveBeenCalledWith('Validation failed');
    });

    it('handles 403 Forbidden', async () => {
      const error: AxiosError<{ error: string }> = {
        response: {
          data: { error: 'Access denied' },
          status: 403,
          statusText: 'Forbidden',
          headers: {},
          config: {} as any,
        },
        isAxiosError: true,
        toJSON: () => ({}),
        name: 'AxiosError',
        message: 'Forbidden',
        config: {} as any,
      } as AxiosError<{ error: string }>;

      await expect(responseErrorInterceptor(error)).rejects.toEqual(error);
      expect(mockedToast.error).toHaveBeenCalledWith('Access denied');
    });

    it('handles 404 Not Found', async () => {
      const error: AxiosError<{ error: string }> = {
        response: {
          data: { error: 'Resource not found' },
          status: 404,
          statusText: 'Not Found',
          headers: {},
          config: {} as any,
        },
        isAxiosError: true,
        toJSON: () => ({}),
        name: 'AxiosError',
        message: 'Not Found',
        config: {} as any,
      } as AxiosError<{ error: string }>;

      await expect(responseErrorInterceptor(error)).rejects.toEqual(error);
      expect(mockedToast.error).toHaveBeenCalledWith('Resource not found');
    });

    it('handles 500 Internal Server Error', async () => {
      const error: AxiosError<{ error: string }> = {
        response: {
          data: { error: 'Server error' },
          status: 500,
          statusText: 'Internal Server Error',
          headers: {},
          config: {} as any,
        },
        isAxiosError: true,
        toJSON: () => ({}),
        name: 'AxiosError',
        message: 'Internal Server Error',
        config: {} as any,
      } as AxiosError<{ error: string }>;

      await expect(responseErrorInterceptor(error)).rejects.toEqual(error);
      expect(mockedToast.error).toHaveBeenCalledWith('Server error');
    });
  });

  describe('Token Refresh Scenarios', () => {
    beforeEach(async () => {
      await import('../../services/api');
    });

    it('uses fresh token for each request', () => {
      // First request without token
      let config: InternalAxiosRequestConfig = {
        headers: {} as any,
      } as InternalAxiosRequestConfig;

      let result = requestInterceptor(config);
      expect(result.headers.Authorization).toBeUndefined();

      // Set token
      localStorage.setItem('token', 'new-token');

      // Second request should have token
      config = {
        headers: {} as any,
      } as InternalAxiosRequestConfig;

      result = requestInterceptor(config);
      expect(result.headers.Authorization).toBe('Bearer new-token');
    });
  });
});
