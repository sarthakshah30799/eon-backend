import { envConfig } from '../config/env.config';
import { TestLogger } from './test-logger';

export interface ApiResponse<T = any> {
  status: number;
  ok: boolean;
  data: T;
  headers: Headers;
  rawText?: string;
}

export class ApiClient {
  public baseUrl: string;
  private cookies: Map<string, string> = new Map();
  public currentUser: { email?: string; userId?: string; role?: string; label?: string } = {};

  constructor(baseUrl: string = envConfig.backendUrl) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  private updateCookies(responseHeaders: Headers) {
    // In Node fetch, getSetCookie() returns all set-cookie header strings
    const setCookieHeaders: string[] = typeof (responseHeaders as any).getSetCookie === 'function'
      ? (responseHeaders as any).getSetCookie()
      : [responseHeaders.get('set-cookie')].filter(Boolean) as string[];

    for (const cookieHeader of setCookieHeaders) {
      if (!cookieHeader) continue;
      const parts = cookieHeader.split(';');
      const [keyVal] = parts;
      const eqIdx = keyVal.indexOf('=');
      if (eqIdx !== -1) {
        const key = keyVal.slice(0, eqIdx).trim();
        const val = keyVal.slice(eqIdx + 1).trim();
        this.cookies.set(key, val);
      }
    }
  }

  public getCookieHeader(): string {
    const list: string[] = [];
    this.cookies.forEach((val, key) => list.push(`${key}=${val}`));
    return list.join('; ');
  }

  public setCookie(key: string, val: string) {
    this.cookies.set(key, val);
  }

  public clearCookies() {
    this.cookies.clear();
    this.currentUser = {};
  }

  public async login(email: string, password: string, label: string = 'User'): Promise<ApiResponse> {
    const res = await this.post('/auth/login', { email, password });
    if (res.ok) {
      this.currentUser = {
        email,
        userId: res.data?.user?.id || res.data?.id,
        role: res.data?.user?.role || res.data?.role,
        label,
      };
      TestLogger.info(`Logged in as [${label}] (${email})`);
    } else {
      TestLogger.warn(`Login failed for [${label}] (${email}): ${res.status} ${JSON.stringify(res.data)}`);
    }
    return res;
  }

  public async logout(): Promise<ApiResponse> {
    const res = await this.post('/auth/logout', {});
    this.clearCookies();
    return res;
  }

  public async get<T = any>(endpoint: string, query?: Record<string, any>): Promise<ApiResponse<T>> {
    let url = `${this.baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    if (query && Object.keys(query).length > 0) {
      const searchParams = new URLSearchParams();
      for (const [k, v] of Object.entries(query)) {
        if (v === undefined || v === null) continue;
        if (Array.isArray(v)) {
          v.forEach((item) => searchParams.append(k, String(item)));
        } else {
          searchParams.append(k, String(v));
        }
      }
      const qs = searchParams.toString();
      if (qs) {
        url += (url.includes('?') ? '&' : '?') + qs;
      }
    }

    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    const cookieStr = this.getCookieHeader();
    if (cookieStr) headers['Cookie'] = cookieStr;

    const res = await this.fetchWithRetry(url, { method: 'GET', headers });
    this.updateCookies(res.headers);

    let data: any = null;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await res.json().catch(() => null);
    } else {
      data = await res.text().catch(() => null);
    }

    return {
      status: res.status,
      ok: res.ok,
      data,
      headers: res.headers,
    };
  }

  public async post<T = any>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    return this.sendWithBody('POST', endpoint, body);
  }

  public async put<T = any>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    return this.sendWithBody('PUT', endpoint, body);
  }

  public async patch<T = any>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    return this.sendWithBody('PATCH', endpoint, body);
  }

  public async delete<T = any>(endpoint: string): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    const cookieStr = this.getCookieHeader();
    if (cookieStr) headers['Cookie'] = cookieStr;

    const res = await this.fetchWithRetry(url, { method: 'DELETE', headers });
    this.updateCookies(res.headers);

    let data: any = null;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await res.json().catch(() => null);
    } else {
      data = await res.text().catch(() => null);
    }

    return {
      status: res.status,
      ok: res.ok,
      data,
      headers: res.headers,
    };
  }

  public async postMultipart<T = any>(endpoint: string, formData: FormData): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    const headers: Record<string, string> = {};
    const cookieStr = this.getCookieHeader();
    if (cookieStr) headers['Cookie'] = cookieStr;

    const res = await this.fetchWithRetry(url, {
      method: 'POST',
      headers,
      body: formData,
    });
    this.updateCookies(res.headers);

    let data: any = null;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await res.json().catch(() => null);
    } else {
      data = await res.text().catch(() => null);
    }

    return {
      status: res.status,
      ok: res.ok,
      data,
      headers: res.headers,
    };
  }

  private async fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
    try {
      return await fetch(url, init);
    } catch (err: any) {
      if (err?.cause?.code === 'ECONNRESET' || err?.message?.includes('fetch failed')) {
        await new Promise((r) => setTimeout(r, 600));
        return await fetch(url, init);
      }
      throw err;
    }
  }

  private async sendWithBody<T = any>(method: string, endpoint: string, body?: any): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
    const cookieStr = this.getCookieHeader();
    if (cookieStr) headers['Cookie'] = cookieStr;

    const res = await this.fetchWithRetry(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    this.updateCookies(res.headers);

    let data: any = null;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await res.json().catch(() => null);
    } else {
      data = await res.text().catch(() => null);
    }

    return {
      status: res.status,
      ok: res.ok,
      data,
      headers: res.headers,
    };
  }
}

