export type Workflow = {
  key: string;
  name: string;
  description: string;
  category: string;
  icon: string;
};
export type Task = {
  id: string;
  name: string;
  created?: string;
  due?: string;
  assignee?: string;
  request_id?: string;
  processInstanceId?: string;
  workflow_key?: string;
  is_team_task?: boolean;
};
export type RequestItem = {
  id: string;
  title: string;
  workflow_key: string;
  workflow_name: string;
  status: string;
  status_label: string;
  started?: string;
  ended?: string;
};
export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch('/api' + path, { ...options, credentials: 'same-origin', headers: { ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), 'X-Requested-With': 'portal', ...options.headers } }); const data = await response.json().catch(() => ({})); if (!response.ok)
    throw new ApiError(response.status, data.error?.message || 'Something went wrong. Please try again.'); return data as T;
}
export const post = <T,>(path: string, values: unknown = {}) => api<T>(path, { method: 'POST', body: JSON.stringify(values) });
export const dateLabel = (v?: string) => v ? new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

