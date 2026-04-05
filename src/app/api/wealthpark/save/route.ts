import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

interface JournalInput {
  id: string;
  date: string;
  debit_account: string;
  debit_sub_account: string;
  credit_account: string;
  credit_sub_account: string;
  amount: number;
  description: string;
}

export async function POST(request: NextRequest) {
  try {
    const { journals } = await request.json();

    if (!journals || !Array.isArray(journals)) {
      return NextResponse.json({ error: "journals が必要です" }, { status: 400 });
    }

    const db = getDb();

    const insert = db.prepare(
      "INSERT INTO journal_entries (id, ocr_result_id, date, debit_account, debit_sub_account, credit_account, credit_sub_account, amount, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );

    const insertMany = db.transaction((entries: JournalInput[]) => {
      for (const j of entries) {
        insert.run(
          j.id, null, j.date,
          j.debit_account, j.debit_sub_account,
          j.credit_account, j.credit_sub_account,
          j.amount, j.description
        );
      }
    });

    insertMany(journals);

    return NextResponse.json({ success: true, count: journals.length });
  } catch (error) {
    console.error("Journal save error:", error);
    return NextResponse.json({ error: "保存に失敗しました" }, { status: 500 });
  }
}
