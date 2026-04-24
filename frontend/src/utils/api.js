import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refreshToken = localStorage.getItem('refreshToken');

      if (refreshToken) {
        try {
          const res = await axios.post('/api/auth/refresh', { refreshToken });
          const { accessToken, refreshToken: newRefresh } = res.data.data;
          localStorage.setItem('accessToken', accessToken);
          localStorage.setItem('refreshToken', newRefresh);
          original.headers.Authorization = `Bearer ${accessToken}`;
          return api(original);
        } catch {
          localStorage.clear();
          window.location.href = '/login';
          return Promise.reject(error);
        }
      } else {
        localStorage.clear();
        window.location.href = '/login';
      }
    }

    const msg = error.response?.data?.message || 'An error occurred';
    if (error.response?.status !== 401) toast.error(msg);
    return Promise.reject(error);
  }
);

export default api;
