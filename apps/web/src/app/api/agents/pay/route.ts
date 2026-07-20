import { NextResponse } from "next/server";
import { agentPost } from "../../_lib";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const res = await agentPost("/api/agents/pay", body);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Agent unavailable" }));
      return NextResponse.json(err, { status: res.status });
    }
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: "Cannot connect" }, { status: 503 });
  }
}