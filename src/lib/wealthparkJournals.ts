/**
 * WealthParkの物件データから弥生用の仕訳を生成
 * 物件名を補助科目として使用
 * 金額はすべて税込み
 */

import { WealthParkProperty } from "./wealthparkParser";
import { v4 as uuidv4 } from "uuid";

export interface JournalEntry {
  id: string;
  date: string;
  debit_account: string;
  debit_sub_account: string;
  credit_account: string;
  credit_sub_account: string;
  amount: number;
  description: string;
}

// 支出項目名 → 弥生の勘定科目マッピング
const EXPENSE_ACCOUNT_MAP: Record<string, string> = {
  "管理手数料": "外注費",
  "水道料金": "水道光熱費",
  "電気料金（電灯）": "水道光熱費",
  "電気料金（電力）": "水道光熱費",
  "エレベータ保守料": "修繕費",
  "別借駐車場代": "地代家賃",
  "網戶貼り替え（大）": "修繕費",
  "網戸貼り替え（大）": "修繕費",
};

function getExpenseAccount(name: string): string {
  // 完全一致
  if (EXPENSE_ACCOUNT_MAP[name]) return EXPENSE_ACCOUNT_MAP[name];
  // 部分一致
  for (const [key, account] of Object.entries(EXPENSE_ACCOUNT_MAP)) {
    if (name.includes(key)) return account;
  }
  // 電気・水道系
  if (name.includes("電気") || name.includes("水道") || name.includes("ガス")) return "水道光熱費";
  // 修繕系
  if (name.includes("修繕") || name.includes("貼り替え") || name.includes("工事")) return "修繕費";
  // デフォルト
  return "雑費";
}

/** WealthPark物件データ → 仕訳配列 */
export function wealthParkToJournals(
  property: WealthParkProperty,
  date?: string
): JournalEntry[] {
  const entries: JournalEntry[] = [];
  const d = date || `${property.settlement_month}/15`; // デフォルトは15日
  const prop = property.property_name;

  // === 収入の仕訳（賃貸料・共益費・駐車料・その他をまとめて売上高） ===
  if (property.income.total > 0) {
    entries.push({
      id: uuidv4(),
      date: d,
      debit_account: "普通預金",
      debit_sub_account: "",
      credit_account: "売上高",
      credit_sub_account: prop,
      amount: property.income.total,
      description: `${prop} 賃貸収入`,
    });
  }

  // === 支出の仕訳 ===
  for (const item of property.expense.items) {
    const account = getExpenseAccount(item.name);
    entries.push({
      id: uuidv4(),
      date: d,
      debit_account: account,
      debit_sub_account: prop,
      credit_account: "普通預金",
      credit_sub_account: "",
      amount: item.amount,
      description: `${prop} ${item.name}`,
    });
  }

  return entries;
}
