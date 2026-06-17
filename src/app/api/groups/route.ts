import { NextResponse } from "next/server";
import { searchBusinessGroups } from "@/lib/data/groups";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";

  try {
    const groups = await searchBusinessGroups(query);
    return NextResponse.json({ groups });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Group search failed." },
      { status: 502 },
    );
  }
}
