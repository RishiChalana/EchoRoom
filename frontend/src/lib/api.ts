import type { Session, SessionList, SessionReport, HealthResponse } from "@/types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    credentials: "include",
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export function createSession(name?: string, audienceProfile = "general"): Promise<Session> {
  return apiFetch<Session>("/api/v1/sessions", {
    method: "POST",
    body: JSON.stringify({ audience_profile: audienceProfile, name: name ?? null }),
  });
}

export function getSession(id: string): Promise<Session> {
  return apiFetch<Session>(`/api/v1/sessions/${id}`);
}

export function getSessions(): Promise<SessionList> {
  return apiFetch<SessionList>("/api/v1/sessions");
}

export function endSession(id: string): Promise<Session> {
  return apiFetch<Session>(`/api/v1/sessions/${id}/end`, { method: "PATCH" });
}

/** Returns the report, or null when status is 202 (still generating). */
export async function getReport(id: string): Promise<SessionReport | null> {
  const res = await fetch(`${BASE_URL}/api/v1/reports/${id}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });
  if (res.status === 202) return null;
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json() as Promise<SessionReport>;
}

export async function deleteSession(id: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/v1/sessions/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok && res.status !== 204) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${text}`);
  }
}

export function getHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>("/api/v1/health");
}
