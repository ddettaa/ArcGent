import { NextResponse } from "next/server";
import { agentGet } from "../_lib";

export async function GET() {
  try {
    const res = await agentGet("/api/approvals/pending");
    if (!res.ok) return NextResponse.json({ error: "Agent unavailable" }, { status: 503 });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: "Cannot connect" }, { status: 503 });
  }
}
