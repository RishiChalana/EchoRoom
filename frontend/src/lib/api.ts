import { getSession as getNextAuthSession } from "next-auth/react";
import type { Session, SessionList, SessionReport, HealthResponse } from "@/types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function authHeaders(): Promise<Record<string, string>> {
  const session = await getNextAuthSession();
  console.log("[authHeaders] session:", session);
  console.log("[authHeaders] backendAccessToken present:", !!session?.backendAccessToken);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (session?.backendAccessToken) {
    headers["Authorization"] = `Bearer ${session.backendAccessToken}`;
  }
  return headers;
}

export async function createSession(
  name?: string,
  audienceProfile = "general"
): Promise<Session> {
  const res = await fetch(`${BASE_URL}/api/v1/sessions`, {
    method: "POST",
    headers: await authHeaders(),
    credentials: "include",
    body: JSON.stringify({ audience_profile: audienceProfile, name: name ?? null }),
  });
  if (!res.ok) throw new Error("Failed to create session");
  return res.json() as Promise<Session>;
}

export async function getSession(id: string): Promise<Session> {
  const res = await fetch(`${BASE_URL}/api/v1/sessions/${id}`, {
    headers: await authHeaders(),
    credentials: "include",
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json() as Promise<Session>;
}

export async function getSessions(): Promise<SessionList> {
  const res = await fetch(`${BASE_URL}/api/v1/sessions`, {
    headers: await authHeaders(),
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) return { sessions: [] };
  return res.json() as Promise<SessionList>;
}

export async function endSession(id: string): Promise<Session> {
  const res = await fetch(`${BASE_URL}/api/v1/sessions/${id}/end`, {
    method: "PATCH",
    headers: await authHeaders(),
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to end session");
  return res.json() as Promise<Session>;
}

export async function getReport(id: string): Promise<SessionReport | null> {
  const res = await fetch(`${BASE_URL}/api/v1/reports/${id}`, {
    headers: await authHeaders(),
    credentials: "include",
    cache: "no-store",
  });
  if (res.status === 202) return null;
  if (!res.ok) return null;
  return res.json() as Promise<SessionReport>;
}

export async function deleteSession(id: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/v1/sessions/${id}`, {
    method: "DELETE",
    headers: await authHeaders(),
    credentials: "include",
  });
  if (!res.ok && res.status !== 204) {
    throw new Error("Failed to delete session");
  }
}

export async function getHealth(): Promise<HealthResponse> {
  const res = await fetch(`${BASE_URL}/api/v1/health`, {
    headers: await authHeaders(),
    credentials: "include",
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json() as Promise<HealthResponse>;
}
