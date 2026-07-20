import { NextResponse } from "next/server";
import { agentPost } from "../../_lib";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const res = await agentPost("/api/ai/evaluate", body);
    if (!res.ok) return NextResponse.json({ error: "Agent unavailable" }, { status: 503 });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: "Cannot connect" }, { status: 503 });
  }
}
