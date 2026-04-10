import axios, { AxiosHeaders } from "axios";

export const http = axios.create({
  baseURL: "", // usamos el proxy de Vite (/api -> http://localhost:5048)
  timeout: 60_000,
});

let currentAccessToken: string | null = null;

export const setAuthToken = (token: string | null) => {
  currentAccessToken = token;
};

export const clearAuthToken = () => {
  currentAccessToken = null;
};

http.interceptors.request.use((config) => {
  const token = currentAccessToken;
  if (token) {
    const headers = config.headers instanceof AxiosHeaders
      ? config.headers
      : new AxiosHeaders(config.headers);
    headers.set("Authorization", `Bearer ${token}`);
    config.headers = headers;
  }

  return config;
});

export const getAuthToken = () => currentAccessToken;
