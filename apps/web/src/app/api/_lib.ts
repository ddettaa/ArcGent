const AGENT_API = process.env.AGENT_API_URL || "http://localhost:3001";
const API_KEY = process.env.ARC_ADMIN_KEY || "";

export function agentFetch(path: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };
  if (API_KEY) {
    headers["Authorization"] = `Bearer ${API_KEY}`;
  }
  return fetch(`${AGENT_API}${path}`, { ...options, headers });
}

export function agentGet(path: string) {
  return agentFetch(path, { next: { revalidate: 10 } });
}

export function agentPost(path: string, body?: any) {
  return agentFetch(path, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  });
}
