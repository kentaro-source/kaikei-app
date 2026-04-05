import { NextRequest, NextResponse } from "next/server";
import { parseCardCsv, cardToJournals } from "@/lib/cardCsvParser";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "ファイルが選択されていません" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const transactions = parseCardCsv(buffer);

    if (transactions.length === 0) {
      return NextResponse.json({ error: "取引データが見つかりませんでした" }, { status: 400 });
    }

    const journals = cardToJournals(transactions);

    return NextResponse.json({ transactions, journals });
  } catch (error) {
    console.error("Card CSV parse error:", error);
    return NextResponse.json({ error: "CSVの解析に失敗しました" }, { status: 500 });
  }
}
