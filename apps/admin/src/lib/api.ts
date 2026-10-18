'use client';

import axios from 'axios';

const api = axios.create({
  baseURL: '/bff',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      window.location.href = '/login?expired=1';
    }
    return Promise.reject(err);
  },
);

export default api;
