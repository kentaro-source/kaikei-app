import { NextRequest, NextResponse } from "next/server";
import { wealthParkToJournals } from "@/lib/wealthparkJournals";

export async function POST(request: NextRequest) {
  try {
    const { properties, isPersonal } = await request.json();

    if (!properties || !Array.isArray(properties)) {
      return NextResponse.json({ error: "properties が必要です" }, { status: 400 });
    }

    const allJournals = properties.flatMap((prop: Parameters<typeof wealthParkToJournals>[0]) =>
      wealthParkToJournals(prop, undefined, !!isPersonal)
    );

    return NextResponse.json({ journals: allJournals });
  } catch (error) {
    console.error("Journal generation error:", error);
    return NextResponse.json({ error: "仕訳生成に失敗しました" }, { status: 500 });
  }
}
