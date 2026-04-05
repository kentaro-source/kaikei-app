import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// 法人期首: 12月
// 期: 2025/12 〜 2026/11

interface MonthProgress {
  month: string; // YYYY/MM
  count: number;
  total: number;
}

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const url = new URL(request.url);
    const source = url.searchParams.get("source") || "all"; // wealthpark, bankbook, card, all

    // descriptionからソースを判別
    let whereClause = "";
    if (source === "wealthpark") {
      whereClause = "AND (description LIKE '%賃貸収入%' OR description LIKE '%管理費%' OR description LIKE '%水道光熱費%' OR description LIKE '%修繕費%' OR description LIKE '%通信費%' OR description LIKE '%地代家賃%' OR description LIKE '%インターネット%' OR credit_account = '売上高')";
    } else if (source === "bankbook") {
      whereClause = "AND (description LIKE '%社会保険%' OR description LIKE '%借入金%' OR description LIKE '%定期積金%' OR description LIKE '%産業医%' OR description LIKE '%受取利息%' OR description LIKE '%法人税%' OR description LIKE '%通信費 SMBC%' OR debit_account = '長期借入金' OR debit_account = '支払利息' OR debit_account = '定期積金' OR debit_account = '法定福利費' OR credit_account = '産業医収入' OR credit_account = '受取利息')";
    } else if (source === "card") {
      whereClause = "AND credit_account = '未払金'";
    }

    const rows = db.prepare(`
      SELECT
        SUBSTR(date, 1, 7) as month,
        COUNT(*) as count,
        SUM(amount) as total
      FROM journal_entries
      WHERE exported = 0 OR exported = 1
      ${whereClause}
      GROUP BY SUBSTR(date, 1, 7)
      ORDER BY month
    `).all() as MonthProgress[];

    // 期の月リスト（12月〜11月）を生成
    const now = new Date();
    const currentYear = now.getMonth() >= 11 ? now.getFullYear() : now.getFullYear() - 1;
    const months: { month: string; count: number; total: number }[] = [];
    for (let i = 0; i < 12; i++) {
      const m = ((11 + i) % 12) + 1; // 12,1,2,...,11
      const y = m === 12 ? currentYear : currentYear + 1;
      const monthStr = `${y}/${String(m).padStart(2, "0")}`;
      const found = rows.find((r) => r.month === monthStr);
      months.push({
        month: monthStr,
        count: found?.count || 0,
        total: found?.total || 0,
      });
    }

    return NextResponse.json({ months, period: `${currentYear}/12 〜 ${currentYear + 1}/11` });
  } catch (error) {
    console.error("Progress error:", error);
    return NextResponse.json({ error: "進捗取得に失敗しました" }, { status: 500 });
  }
}
