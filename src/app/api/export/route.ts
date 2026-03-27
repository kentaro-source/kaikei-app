import { NextRequest, NextResponse } from "next/server";
import { getDb, JournalEntry } from "@/lib/db";
import { generateYayoiCsv } from "@/lib/yayoiCsv";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const onlyUnexported = searchParams.get("unexported") === "1";

    const db = getDb();
    let query = "SELECT * FROM journal_entries";
    const conditions: string[] = [];
    const params: string[] = [];

    if (from) {
      conditions.push("date >= ?");
      params.push(from);
    }
    if (to) {
      conditions.push("date <= ?");
      params.push(to);
    }
    if (onlyUnexported) {
      conditions.push("exported = 0");
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }
    query += " ORDER BY date ASC";

    const entries = db.prepare(query).all(...params) as JournalEntry[];

    return NextResponse.json({ entries, count: entries.length });
  } catch (error) {
    console.error("Export fetch error:", error);
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { entry_ids } = body;

    const db = getDb();
    let entries: JournalEntry[];

    if (entry_ids && entry_ids.length > 0) {
      const placeholders = entry_ids.map(() => "?").join(",");
      entries = db
        .prepare(`SELECT * FROM journal_entries WHERE id IN (${placeholders}) ORDER BY date ASC`)
        .all(...entry_ids) as JournalEntry[];
    } else {
      entries = db
        .prepare("SELECT * FROM journal_entries WHERE exported = 0 ORDER BY date ASC")
        .all() as JournalEntry[];
    }

    if (entries.length === 0) {
      return NextResponse.json({ error: "エクスポート対象の仕訳がありません" }, { status: 400 });
    }

    const csv = generateYayoiCsv(
      entries.map((e) => ({
        id: e.id,
        date: e.date,
        debit_account: e.debit_account,
        debit_sub_account: e.debit_sub_account || "",
        credit_account: e.credit_account,
        credit_sub_account: e.credit_sub_account || "",
        amount: e.amount,
        description: e.description || "",
      }))
    );

    // エクスポート済みフラグ更新
    const updateStmt = db.prepare("UPDATE journal_entries SET exported = 1 WHERE id = ?");
    for (const entry of entries) {
      updateStmt.run(entry.id);
    }

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="yayoi_import_${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json({ error: "エクスポートに失敗しました" }, { status: 500 });
  }
}
