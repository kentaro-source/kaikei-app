import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const url = new URL(request.url);
    const source = url.searchParams.get("source") || "all";

    const whereClause = source !== "all" ? "WHERE source = ?" : "";
    const params = source !== "all" ? [source] : [];

    // 月ごとの件数・合計
    const monthRows = db.prepare(`
      SELECT
        SUBSTR(date, 1, 7) as month,
        COUNT(*) as count,
        SUM(amount) as total,
        MIN(date) as first_date,
        MAX(date) as last_date
      FROM journal_entries
      ${whereClause}
      GROUP BY SUBSTR(date, 1, 7)
      ORDER BY month
    `).all(...params) as { month: string; count: number; total: number; first_date: string; last_date: string }[];

    // 期の月リスト（12月〜11月）
    const now = new Date();
    const currentYear = now.getMonth() >= 11 ? now.getFullYear() : now.getFullYear() - 1;
    const months = [];
    for (let i = 0; i < 12; i++) {
      const m = ((11 + i) % 12) + 1;
      const y = m === 12 ? currentYear : currentYear + 1;
      const monthStr = `${y}/${String(m).padStart(2, "0")}`;
      const found = monthRows.find((r) => r.month === monthStr);
      months.push({
        month: monthStr,
        count: found?.count || 0,
        total: found?.total || 0,
        first_date: found?.first_date || "",
        last_date: found?.last_date || "",
      });
    }

    return NextResponse.json({ months, period: `${currentYear}/12 〜 ${currentYear + 1}/11` });
  } catch (error) {
    console.error("Progress error:", error);
    return NextResponse.json({ error: "進捗取得に失敗しました" }, { status: 500 });
  }
}
