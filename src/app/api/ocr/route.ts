import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import { parseRentStatement, parseSalarySlip } from "@/lib/ocr";
import { rentStatementToJournals, salarySlipToJournals } from "@/lib/journalMapping";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { document_id, raw_text, parsed_data, template_id } = body;

    if (!document_id || !raw_text) {
      return NextResponse.json({ error: "必須パラメータが不足しています" }, { status: 400 });
    }

    const db = getDb();
    const doc = db.prepare("SELECT * FROM documents WHERE id = ?").get(document_id) as {
      id: string;
      type: string;
    } | undefined;

    if (!doc) {
      return NextResponse.json({ error: "書類が見つかりません" }, { status: 404 });
    }

    // OCR結果をパース
    let finalParsedData = parsed_data;
    if (!finalParsedData) {
      if (doc.type === "rent_statement") {
        finalParsedData = parseRentStatement(raw_text);
      } else if (doc.type === "salary_slip") {
        finalParsedData = parseSalarySlip(raw_text);
      }
    }

    // OCR結果をDB保存
    const ocrId = uuidv4();
    db.prepare(
      "INSERT INTO ocr_results (id, document_id, raw_text, parsed_data, template_id) VALUES (?, ?, ?, ?, ?)"
    ).run(ocrId, document_id, raw_text, JSON.stringify(finalParsedData), template_id || null);

    // ステータス更新
    db.prepare("UPDATE documents SET status = 'ocr_done' WHERE id = ?").run(document_id);

    // 仕訳候補を自動生成
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "/");
    let journals: ReturnType<typeof rentStatementToJournals> = [];

    if (doc.type === "rent_statement" && finalParsedData) {
      journals = rentStatementToJournals(finalParsedData, today);
    } else if (doc.type === "salary_slip" && finalParsedData) {
      journals = salarySlipToJournals(finalParsedData, today);
    }

    // 仕訳をDB保存
    const insertJournal = db.prepare(
      "INSERT INTO journal_entries (id, ocr_result_id, date, debit_account, debit_sub_account, credit_account, credit_sub_account, amount, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    for (const j of journals) {
      insertJournal.run(j.id, ocrId, j.date, j.debit_account, j.debit_sub_account, j.credit_account, j.credit_sub_account, j.amount, j.description);
    }

    const ocrResult = db.prepare("SELECT * FROM ocr_results WHERE id = ?").get(ocrId);
    const savedJournals = db.prepare("SELECT * FROM journal_entries WHERE ocr_result_id = ?").all(ocrId);

    return NextResponse.json({ ocrResult, journals: savedJournals });
  } catch (error) {
    console.error("OCR save error:", error);
    return NextResponse.json({ error: "OCR結果の保存に失敗しました" }, { status: 500 });
  }
}
