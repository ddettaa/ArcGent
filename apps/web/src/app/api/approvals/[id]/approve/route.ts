import { NextResponse } from "next/server";
import { agentPost } from "../../../_lib";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const res = await agentPost(`/api/approvals/${params.id}/approve`);
    if (!res.ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: "Cannot connect" }, { status: 503 });
  }
}
