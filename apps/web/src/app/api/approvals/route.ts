import { NextResponse } from "next/server";
import { agentGet } from "../_lib";

export async function GET(req: Request) {
  try {
    const wallet = req.headers.get("x-wallet-address") || undefined;
    const res = await agentGet("/api/approvals", wallet);
    if (!res.ok) return NextResponse.json({ error: "Agent unavailable" }, { status: 503 });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: "Cannot connect" }, { status: 503 });
  }
}
