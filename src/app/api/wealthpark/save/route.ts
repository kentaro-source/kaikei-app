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
    const { journals, source } = await request.json();

    if (!journals || !Array.isArray(journals)) {
      return NextResponse.json({ error: "journals が必要です" }, { status: 400 });
    }

    const db = getDb();

    // 重複チェック: 同じ日付・借方・貸方・金額・摘要の仕訳が既にあればスキップ
    const checkDuplicate = db.prepare(
      "SELECT COUNT(*) as count FROM journal_entries WHERE date = ? AND debit_account = ? AND credit_account = ? AND amount = ? AND description = ?"
    );

    const src = source || "other";
    const insert = db.prepare(
      "INSERT INTO journal_entries (id, ocr_result_id, source, date, debit_account, debit_sub_account, credit_account, credit_sub_account, amount, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );

    let inserted = 0;
    let skipped = 0;

    const insertMany = db.transaction((entries: JournalInput[]) => {
      for (const j of entries) {
        const existing = checkDuplicate.get(j.date, j.debit_account, j.credit_account, j.amount, j.description) as { count: number };
        if (existing.count > 0) {
          skipped++;
          continue;
        }
        insert.run(
          j.id, null, src, j.date,
          j.debit_account, j.debit_sub_account,
          j.credit_account, j.credit_sub_account,
          j.amount, j.description
        );
        inserted++;
      }
    });

    insertMany(journals);

    return NextResponse.json({ success: true, inserted, skipped });
  } catch (error) {
    console.error("Journal save error:", error);
    return NextResponse.json({ error: "保存に失敗しました" }, { status: 500 });
  }
}
