import { NextResponse } from "next/server";
import { evaluateCompany } from "@/lib/data/evaluate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await context.params;
  const { searchParams } = new URL(request.url);
  const includeFilings = searchParams.get("filings") === "1";

  try {
    const evaluation = await evaluateCompany(symbol, { includeFilings });
    return NextResponse.json(
      { evaluation },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Company evaluation failed." },
      {
        status: 502,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
