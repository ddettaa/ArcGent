import { NextResponse } from "next/server";
import { agentPost } from "../_lib";

export async function POST() {
  try {
    const res = await agentPost("/api/revive");
    if (!res.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: "Cannot connect" }, { status: 503 });
  }
}
