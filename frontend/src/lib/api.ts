import axios, { AxiosError } from 'axios';

export const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

const ACCESS_KEY = 'seguros.access';
const REFRESH_KEY = 'seguros.refresh';

export const tokens = {
  get access() {
    return localStorage.getItem(ACCESS_KEY);
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY);
  },
  save(access: string, refresh: string) {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

api.interceptors.request.use((config) => {
  const token = tokens.access;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/** Renovação de sessão: uma única chamada de refresh compartilhada entre requisições concorrentes. */
let refreshInFlight: Promise<string> | null = null;

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as typeof error.config & { _retried?: boolean };
    const isLogin = original?.url?.includes('/auth/login');

    if (error.response?.status !== 401 || original?._retried || isLogin || !tokens.refresh) {
      return Promise.reject(error);
    }

    original._retried = true;

    try {
      refreshInFlight ??= axios
        .post('/api/auth/refresh', { refreshToken: tokens.refresh })
        .then((r) => {
          tokens.save(r.data.accessToken, r.data.refreshToken);
          return r.data.accessToken as string;
        })
        .finally(() => {
          refreshInFlight = null;
        });

      const fresh = await refreshInFlight;
      original.headers!.Authorization = `Bearer ${fresh}`;
      return api(original);
    } catch {
      tokens.clear();
      if (!location.pathname.startsWith('/sign-in')) {
        location.href = '/sign-in';
      }
      return Promise.reject(error);
    }
  },
);

/**
 * Remove chaves com string vazia do payload — formulários mandam "" para campos
 * não preenchidos, e o backend espera ausência para tratá-los como opcionais.
 */
export function cleanPayload<T extends Record<string, any>>(payload: T): T {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(payload)) {
    result[key] = typeof value === 'string' && value.trim() === '' ? undefined : value;
  }
  return result as T;
}

/** Extrai uma mensagem legível do erro da API. */
export function errorMessage(error: unknown, fallback = 'Não foi possível concluir a operação.') {
  const data = (error as AxiosError<{ message?: string | string[] }>)?.response?.data;
  const msg = data?.message;
  if (Array.isArray(msg)) return msg[0];
  return msg || fallback;
}
