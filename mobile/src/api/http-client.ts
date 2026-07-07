import axios from 'axios';

import { API_BASE_URL } from '@/constants/api-base-url';

export const httpClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

export function setAccessToken(token?: string | null) {
  if (!token) {
    delete httpClient.defaults.headers.common.Authorization;
    return;
  }

  httpClient.defaults.headers.common.Authorization = `Bearer ${token}`;
}
