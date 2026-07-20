import { NextResponse } from "next/server";

const AGENT_API = process.env.AGENT_API_URL || "http://localhost:3001";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const res = await fetch(`${AGENT_API}/api/rules/${id}/toggle`, { method: "POST" });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "Agent API unavailable" }, { status: 503 });
  }
}
