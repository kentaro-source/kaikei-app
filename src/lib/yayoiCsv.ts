import { JournalEntryData } from "./journalMapping";

/**
 * 弥生会計デスクトップ版 仕訳インポートCSV生成
 *
 * 弥生フォーマット（カンマ区切り、Shift_JIS）:
 * 識別フラグ, 伝票No, 決算, 取引日付, 借方勘定科目, 借方補助科目, 借方部門,
 * 借方税区分, 借方金額, 借方税金額, 貸方勘定科目, 貸方補助科目, 貸方部門,
 * 貸方税区分, 貸方金額, 貸方税金額, 摘要, 番号, 期日, タイプ, 生成元,
 * 仕訳メモ, 付箋1, 付箋2, 調整
 */

function escapeField(value: string): string {
  if (value.includes('"') || value.includes(",") || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return `"${value}"`;
}

function formatDate(dateStr: string): string {
  // YYYY/MM/DD形式に変換
  const parts = dateStr.split("/");
  if (parts.length === 3) return dateStr;
  if (parts.length === 2) return `${parts[0]}/${parts[1]}/01`;
  return dateStr;
}

export function generateYayoiCsv(entries: JournalEntryData[]): string {
  const rows: string[] = [];

  for (const entry of entries) {
    const date = formatDate(entry.date);
    const row = [
      "2000",                              // 識別フラグ（仕訳データ）
      "",                                  // 伝票No
      "0",                                 // 決算（0=通常）
      date,                                // 取引日付
      entry.debit_account,                 // 借方勘定科目
      entry.debit_sub_account || "",       // 借方補助科目
      "",                                  // 借方部門
      "対象外",                            // 借方税区分
      entry.amount.toString(),             // 借方金額
      "0",                                 // 借方税金額
      entry.credit_account,               // 貸方勘定科目
      entry.credit_sub_account || "",      // 貸方補助科目
      "",                                  // 貸方部門
      "対象外",                            // 貸方税区分
      entry.amount.toString(),             // 貸方金額
      "0",                                 // 貸方税金額
      entry.description || "",             // 摘要
      "",                                  // 番号
      "",                                  // 期日
      "0",                                 // タイプ（0=仕訳）
      "",                                  // 生成元
      "",                                  // 仕訳メモ
      "0",                                 // 付箋1
      "0",                                 // 付箋2
      "0",                                 // 調整
    ].map(escapeField);

    rows.push(row.join(","));
  }

  return rows.join("\r\n");
}

/** UTF-8 → Shift_JIS変換用のBlobを生成（ブラウザ側で使用） */
export function csvToShiftJisBlob(csv: string): Blob {
  // サーバー側ではUTF-8で返し、クライアント側でShift_JIS変換する
  return new Blob([csv], { type: "text/csv;charset=utf-8" });
}
