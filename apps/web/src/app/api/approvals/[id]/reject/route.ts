import { NextResponse } from "next/server";
import { agentPost } from "../../../_lib";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const res = await agentPost(`/api/approvals/${id}/reject`);
    if (!res.ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: "Cannot connect" }, { status: 503 });
  }
}
