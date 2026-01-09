import axios from "axios";

export const http = axios.create({
  baseURL: "", // usamos el proxy de Vite (/api -> http://localhost:5048)
  timeout: 60_000,
});
