import { NextResponse } from "next/server";

const AGENT_API = process.env.AGENT_API_URL || "http://localhost:3001";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const res = await fetch(`${AGENT_API}/api/kill`, { method: "POST" });
    if (!res.ok) return NextResponse.json({ error: "Agent unavailable" }, { status: 503 });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: "Cannot connect" }, { status: 503 });
  }
}
