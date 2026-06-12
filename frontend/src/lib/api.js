import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
export const API_BASE = `${BACKEND_URL}/api`;

const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('badadz_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401) {
      // token bad, drop it
      const path = window.location.pathname;
      if (!['/login', '/register'].includes(path)) {
        localStorage.removeItem('badadz_token');
      }
    }
    return Promise.reject(error);
  }
);

export default api;
