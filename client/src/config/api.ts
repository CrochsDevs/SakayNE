import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getAuth, clearAuth } from '@/src/auth/auth.store';

const devHost = Constants.expoConfig?.hostUri?.split(':')[0];
const host = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.hostname : devHost || (Platform.OS === 'android' ? '10.0.2.2' : 'localhost');
export const API_BASE = (process.env.EXPO_PUBLIC_API_URL || `http://${host}:3010/api`).replace(/\/$/, '');
export async function apiFetch(url: string, options: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
  const { timeoutMs = 15000, ...requestOptions } = options;
  const { token } = await getAuth();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...requestOptions, signal: controller.signal, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...requestOptions.headers } });
    if (response.status === 401 && !url.endsWith('/auth/login')) await clearAuth();
    return response;
  } catch (error) {
    throw new Error(error instanceof Error && error.name === 'AbortError' ? 'Server request timed out. Please retry.' : 'Cannot reach SakayNE server. Check your connection and API address.');
  } finally { clearTimeout(timer); }
}
export async function apiRequest<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await apiFetch(`${API_BASE}${path}`, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data as T;
}
