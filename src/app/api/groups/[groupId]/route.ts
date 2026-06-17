import { NextResponse } from "next/server";
import { getBusinessGroup } from "@/lib/data/groups";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await context.params;

  try {
    const group = await getBusinessGroup(decodeURIComponent(groupId));
    if (!group) {
      return NextResponse.json({ error: "Group not found." }, { status: 404 });
    }

    return NextResponse.json({ group });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Group lookup failed." },
      { status: 502 },
    );
  }
}
