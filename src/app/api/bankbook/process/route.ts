import { NextRequest, NextResponse } from "next/server";
import { processBankTransactions } from "@/lib/bankbookJournals";

export async function POST(request: NextRequest) {
  try {
    const { transactions, start_date } = await request.json();

    if (!transactions || !Array.isArray(transactions)) {
      return NextResponse.json({ error: "transactions が必要です" }, { status: 400 });
    }

    const results = processBankTransactions(transactions, start_date);

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Bankbook process error:", error);
    return NextResponse.json({ error: "通帳処理に失敗しました" }, { status: 500 });
  }
}
