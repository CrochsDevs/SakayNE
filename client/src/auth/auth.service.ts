import { saveAuth, clearAuth, getAuth } from './auth.store';
import { User } from '@/src/types';

import { API_BASE, apiFetch, apiRequest } from '@/src/config/api';

async function handleResponse(res: Response) {
  try {
    const data = await res.json();
    if (!res.ok) throw Object.assign(new Error(data.error || 'Something went wrong'), { code: data.code });
    return data;
  } catch (err: any) {
    if (err.message === 'Failed to fetch' || err.message.includes('Network request failed')) {
      throw new Error('Unable to connect to server. Please check your internet connection.');
    }
    throw err;
  }
}

export async function signup(fullName: string, email: string, phone: string, password: string, role: 'passenger' | 'driver' = 'passenger', extra?: any) {
  const res = await apiFetch(`${API_BASE}/auth/signup`, {
    method: 'POST',
    timeoutMs: 30000,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fullName, email, phone, password, role, ...extra }),
  });
  return handleResponse(res);
}

export async function checkEmailAvailable(email: string) {
  return apiRequest<{ available: boolean }>('/auth/check-email', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function verifyEmail(email: string, otp: string) {
  const res = await apiFetch(`${API_BASE}/auth/verify-email`, {
    method: 'POST',
    timeoutMs: 90000,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp }),
  });
  return handleResponse(res);
}

export async function login(identifier: string, password: string) {
  const res = await apiFetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  });
  const data = await handleResponse(res);
  await saveAuth(data.user, data.token);
  return data;
}

export async function forgotPassword(email: string) {
  const res = await apiFetch(`${API_BASE}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  return handleResponse(res);
}

export async function resetPassword(email: string, otp: string, newPassword: string) {
  const res = await apiFetch(`${API_BASE}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp, newPassword }),
  });
  return handleResponse(res);
}

export async function getNotifications(email: string) {
  const res = await apiFetch(`${API_BASE}/notifications/`, { headers: { 'user-email': email } });
  const data = await handleResponse(res);
  return data.notifications || [];
}

export async function markNotifRead(email: string, notificationId?: string) {
  const res = await apiFetch(`${API_BASE}/notifications/mark-read`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, notificationId }),
  });
  await handleResponse(res);
}

export async function getNotifSettings(email: string) {
  const res = await apiFetch(`${API_BASE}/notifications/settings`, { headers: { 'user-email': email } });
  const data = await handleResponse(res);
  return data;
}

export async function updateNotifSettings(email: string, settings: any) {
  const res = await apiFetch(`${API_BASE}/notifications/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...settings, emailEnabled: settings.email, email }),
  });
  return handleResponse(res);
}

export async function changePassword(email: string, currentPassword: string, newPassword: string) {
  const res = await apiFetch(`${API_BASE}/auth/change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, currentPassword, newPassword }),
  });
  return handleResponse(res);
}

export async function logout() {
  try { await apiRequest('/auth/logout', { method: 'POST' }); } finally { await clearAuth(); }
}

export async function getCurrentUser(): Promise<User | null> {
  const { user } = await getAuth();
  return user;
}

export async function getUserProfile(userId: string) {
  const res = await apiFetch(`${API_BASE}/users/profile`, {
    headers: { 'user-id': userId },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Profile unavailable');
  return data.user as User;
}

export async function updateUserProfile(userId: string, updates: Partial<User>) {
  const res = await apiFetch(`${API_BASE}/users/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'user-id': userId },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Update failed');
  const { user: current, token } = await getAuth();
  if (current) await saveAuth({ ...current, fullName: updates.fullName || current.fullName, phone: updates.phone || current.phone }, token || '');
  return true;
}

export async function uploadAvatar(userId: string, imageBase64: string, mimeType = 'image/jpeg') {
  const res = await apiFetch(`${API_BASE}/users/upload-avatar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'user-id': userId },
    body: JSON.stringify({ image: imageBase64, mimeType }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Upload failed');
  const { user: current, token } = await getAuth();
  if (current) await saveAuth({ ...current, avatar: data.avatar }, token || '');
  return data.avatar;
}

export async function refreshCurrentUser(): Promise<User> {
  const { user } = await apiRequest<{ user: User }>('/auth/me');
  const { token } = await getAuth();
  if (token) await saveAuth(user, token);
  return user;
}

export const resendVerification = (email: string) => apiRequest('/otp/send', { method: 'POST', body: JSON.stringify({ email }) });
