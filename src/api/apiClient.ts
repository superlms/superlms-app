import axios, {
  AxiosInstance,
  InternalAxiosRequestConfig,
  AxiosResponse,
  AxiosError,
} from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import constant from '../utils/constant';


const apiClient: AxiosInstance = axios.create({
  baseURL: constant.API_BASE_URL,
  timeout: 15000,
  headers: { Accept: 'application/json' },
});

// Attach token to every request
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await AsyncStorage.getItem('auth_token');
    console.log('[apiClient] Token from storage:', token ? `${token.slice(0, 20)}...` : 'NULL');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error),
);

// Handle 401 globally
apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      await AsyncStorage.multiRemove(['auth_token', 'user_data', 'user_role']);
    }
    return Promise.reject(error);
  },
);

export default apiClient;
