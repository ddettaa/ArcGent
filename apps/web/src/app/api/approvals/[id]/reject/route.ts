import { NextResponse } from "next/server";

const AGENT_API = process.env.AGENT_API_URL || "http://localhost:3001";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const res = await fetch(`${AGENT_API}/api/approvals/${params.id}/reject`, { method: "POST" });
    if (!res.ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: "Cannot connect" }, { status: 503 });
  }
}
