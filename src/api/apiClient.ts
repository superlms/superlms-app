import axios, {
  AxiosInstance,
  InternalAxiosRequestConfig,
  AxiosResponse,
  AxiosError,
} from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import constant from '../utils/constant';
import { TransferHandle, filesIn, startTransfer } from '../utils/transfers';


const apiClient: AxiosInstance = axios.create({
  baseURL: constant.API_BASE_URL,
  timeout: 15000,
  headers: { Accept: 'application/json' },
});

// Attach token to every request
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await AsyncStorage.getItem('auth_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error),
);

// ── Uploads, as they go ─────────────────────────────────────────────────────
// A request that carries a file reports how much of it has gone up, so the
// saving button (or the toast) can show it. `uploadLabel` names it; else the
// file's own name. `trackUpload: false` keeps one quiet.
type TrackedConfig = InternalAxiosRequestConfig & { __upload?: TransferHandle };

apiClient.interceptors.request.use((config: TrackedConfig) => {
  if (config.trackUpload === false || config.__upload) return config;
  const files = filesIn(config.data);
  if (!files) return config;
  const handle = startTransfer('upload', config.uploadLabel || files);
  config.__upload = handle;
  const theirs = config.onUploadProgress;
  config.onUploadProgress = e => {
    handle.update(e.loaded, e.total);
    theirs?.(e);
  };
  return config;
});

apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    (response.config as TrackedConfig).__upload?.done();
    return response;
  },
  (error: AxiosError) => {
    (error.config as TrackedConfig | undefined)?.__upload?.fail();
    return Promise.reject(error);
  },
);

// ── Asking again when the server stumbles ───────────────────────────────────
// A read that fails for a moment — the server busy or restarting (500, 502,
// 503, 504), too many requests (429), the network dropping or a timeout — is
// asked again, twice at most, a little later each time. The same read pressed
// again by hand used to work, so a screen showed "Server Error" (or, reading
// nothing, "not a class teacher") until it was refreshed. Only reads are asked
// again: a save sent twice could save twice. A request can opt out with
// `retry: false` in its config.
const RETRY_STATUS = new Set([429, 500, 502, 503, 504, 520, 521, 522, 523, 524]);
const MAX_RETRIES = 2;
// A timed-out read has already waited 15 s; it is asked once more, not twice.
const MAX_TIMEOUT_RETRIES = 1;

declare module 'axios' {
  interface AxiosRequestConfig {
    /** false: a failed read is not asked again. */
    retry?: boolean;
    /** false: a file going up is not shown going up. */
    trackUpload?: boolean;
    /** What the upload is called while it goes ("Homework photo"). */
    uploadLabel?: string;
  }
}

type RetryConfig = InternalAxiosRequestConfig & { __tries?: number };

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(() => resolve(), ms));

const shouldRetry = (error: AxiosError, config?: RetryConfig): boolean => {
  if (!config || config.retry === false || axios.isCancel(error)) return false;
  const method = (config.method ?? 'get').toLowerCase();
  if (method !== 'get' && method !== 'head') return false;

  const tries = config.__tries ?? 0;
  const timedOut = error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT';
  if (timedOut) return tries < MAX_TIMEOUT_RETRIES;

  const status = error.response?.status;
  // No answer at all: the network, not the server.
  if (!error.response) return tries < MAX_RETRIES;
  return status != null && RETRY_STATUS.has(status) && tries < MAX_RETRIES;
};

apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const config = error.config as RetryConfig | undefined;

    if (error.response?.status === 401) {
      // Signed out only when the token refused is still the one in use: a late
      // answer to a request sent with an account's old token (logged out, or
      // switched away from) must not sign out the account now in use.
      const sent = String(config?.headers?.Authorization ?? '').replace(/^Bearer\s+/i, '');
      const current = await AsyncStorage.getItem('auth_token');
      if (!sent || !current || sent === current) {
        await AsyncStorage.multiRemove(['auth_token', 'user_data', 'user_role']);
      }
      return Promise.reject(error);
    }

    if (config && shouldRetry(error, config)) {
      config.__tries = (config.__tries ?? 0) + 1;
      // 0.6 s, then 1.5 s — or what the server asked for with Retry-After.
      const after = Number(error.response?.headers?.['retry-after']);
      const delay = Number.isFinite(after) && after > 0 ? Math.min(after * 1000, 5000) : config.__tries === 1 ? 600 : 1500;
      await wait(delay);
      return apiClient(config);
    }

    return Promise.reject(error);
  },
);

export default apiClient;
