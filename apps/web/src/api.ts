const configured = import.meta.env.VITE_API_URL?.trim();
export const API_BASE_URL = (configured || 'https://sentinel-bot.thienhn.io.vn').replace(/\/$/, '');

export async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`API returned ${response.status}`);
  return response.json() as Promise<T>;
}

export async function postJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { method: 'POST', cache: 'no-store' });
  if (!response.ok) throw new Error(`API returned ${response.status}`);
  return response.json() as Promise<T>;
}
