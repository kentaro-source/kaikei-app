/**
 * マネーフォワードのカード明細CSVをパース
 * エンコーディング: Shift_JIS
 * フォーマット: 計算対象,日付,内容,金額（円）,保有金融機関,大項目,中項目,メモ,振替,ID
 */

import { v4 as uuidv4 } from "uuid";
import iconv from "iconv-lite";

export interface CardTransaction {
  date: string;
  description: string;
  amount: number; // 負の数（支出）
  institution: string;
  category_major: string;
  category_minor: string;
  memo: string;
  is_transfer: boolean;
}

export interface CardJournalEntry {
  id: string;
  date: string;
  debit_account: string;
  debit_sub_account: string;
  credit_account: string;
  credit_sub_account: string;
  amount: number;
  description: string;
}

// マネーフォワードの中項目 → 弥生の勘定科目
const CATEGORY_MAP: Record<string, string> = {
  "ガソリン": "車両費",
  "車検・整備": "車両費",
  "駐車場": "車両費",
  "自動車保険": "車両費",
  "高速料金": "旅費交通費",
  "電車": "旅費交通費",
  "バス": "旅費交通費",
  "タクシー": "旅費交通費",
  "飛行機": "旅費交通費",
  "食料品": "福利厚生費",
  "外食": "接待交際費",
  "カフェ": "接待交際費",
  "書籍": "新聞図書費",
  "日用品": "消耗品費",
  "衣服・美容": "消耗品費",
  "趣味・娯楽": "接待交際費",
  "通信費": "通信費",
  "水道・光熱費": "水道光熱費",
  "住宅": "地代家賃",
  "医療費": "福利厚生費",
  "保険": "保険料",
  "税金": "租税公課",
  "その他": "雑費",
};

function getCategoryAccount(major: string, minor: string): string {
  if (CATEGORY_MAP[minor]) return CATEGORY_MAP[minor];
  if (CATEGORY_MAP[major]) return CATEGORY_MAP[major];
  return "雑費";
}

/** Shift_JIS CSVバッファをパース */
export function parseCardCsv(buffer: Buffer): CardTransaction[] {
  const text = iconv.decode(buffer, "Shift_JIS");
  const lines = text.split("\n").filter((l) => l.trim());

  // ヘッダーをスキップ
  const transactions: CardTransaction[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < 9) continue;

    const amount = parseInt(cols[3].replace(/,/g, ""), 10);
    if (isNaN(amount)) continue;

    transactions.push({
      date: cols[1],
      description: cols[2],
      amount: Math.abs(amount),
      institution: cols[4],
      category_major: cols[5],
      category_minor: cols[6],
      memo: cols[7],
      is_transfer: cols[8] === "1",
    });
  }

  return transactions;
}

/** CSV行をパース（ダブルクォート対応） */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += c;
    }
  }
  result.push(current.trim());
  return result;
}

/** カード取引 → 仕訳 */
export function cardToJournals(transactions: CardTransaction[]): CardJournalEntry[] {
  return transactions
    .filter((t) => !t.is_transfer) // 振替は除外
    .map((t) => ({
      id: uuidv4(),
      date: t.date,
      debit_account: getCategoryAccount(t.category_major, t.category_minor),
      debit_sub_account: "",
      credit_account: "未払金",
      credit_sub_account: "クレジットカード",
      amount: t.amount,
      description: `${t.description}${t.memo ? ` (${t.memo})` : ""}`,
    }));
}
