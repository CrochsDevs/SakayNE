import { API_BASE, apiFetch } from '@/src/config/api';

async function handleResponse(res: Response) {
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed');
  return data;
}

export async function getTokenBalance(email: string) {
  const res = await apiFetch(`${API_BASE}/tokens/balance`, { headers: { 'user-email': email } });
  const data = await res.json();
  return { tokens: data.tokens || 0, lifetime: data.lifetime || 0 };
}

export async function getTokenHistory(email: string) {
  const res = await apiFetch(`${API_BASE}/tokens/history`, { headers: { 'user-email': email } });
  const data = await res.json();
  return data.history || [];
}

export async function addTokens(email: string, amount: number, reason: string) {
  const res = await apiFetch(`${API_BASE}/tokens/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, amount, reason }),
  });
  return handleResponse(res);
}

export async function getCompletedTasks(email: string) {
  const res = await apiFetch(`${API_BASE}/tokens/completed-tasks`, { headers: { 'user-email': email } });
  const data = await res.json();
  return data || {};
}

export async function completeTask(email: string, task: string) {
  const res = await apiFetch(`${API_BASE}/tokens/complete-task`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, task }),
  });
  return handleResponse(res);
}

export async function claimDaily(email: string, day: number) {
  const res = await apiFetch(`${API_BASE}/tokens/claim-daily`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, day }),
  });
  return handleResponse(res);
}

export async function getDailyClaims(email: string) {
  const res = await apiFetch(`${API_BASE}/tokens/daily-claims`, { headers: { 'user-email': email } });
  const data = await res.json();
  return data || {};
}
