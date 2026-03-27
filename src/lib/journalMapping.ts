import { ParsedRentStatement, ParsedSalarySlip } from "./ocr";
import { v4 as uuidv4 } from "uuid";

export interface JournalEntryData {
  id: string;
  date: string;
  debit_account: string;
  debit_sub_account: string;
  credit_account: string;
  credit_sub_account: string;
  amount: number;
  description: string;
}

/** 家賃精算書 → 仕訳データ変換 */
export function rentStatementToJournals(
  data: ParsedRentStatement,
  date: string,
  propertyName?: string
): JournalEntryData[] {
  const entries: JournalEntryData[] = [];
  const prefix = propertyName ? `${propertyName} ` : "";
  const month = data.settlement_month || date;

  // 家賃収入
  if (data.rent_income) {
    entries.push({
      id: uuidv4(),
      date: month,
      debit_account: "普通預金",
      debit_sub_account: "",
      credit_account: "賃貸料",
      credit_sub_account: "",
      amount: data.rent_income,
      description: `${prefix}家賃収入`,
    });
  }

  // 管理費（経費として借方）
  if (data.management_fee) {
    entries.push({
      id: uuidv4(),
      date: month,
      debit_account: "管理費",
      debit_sub_account: "",
      credit_account: "普通預金",
      credit_sub_account: "",
      amount: data.management_fee,
      description: `${prefix}管理費`,
    });
  }

  // 修繕積立金
  if (data.repair_reserve) {
    entries.push({
      id: uuidv4(),
      date: month,
      debit_account: "修繕費",
      debit_sub_account: "",
      credit_account: "普通預金",
      credit_sub_account: "",
      amount: data.repair_reserve,
      description: `${prefix}修繕積立金`,
    });
  }

  return entries;
}

/** 給与明細 → 仕訳データ変換 */
export function salarySlipToJournals(
  data: ParsedSalarySlip,
  date: string,
  employerName?: string
): JournalEntryData[] {
  const entries: JournalEntryData[] = [];
  const prefix = employerName ? `${employerName} ` : "";

  if (data.gross_salary) {
    entries.push({
      id: uuidv4(),
      date,
      debit_account: "普通預金",
      debit_sub_account: "",
      credit_account: "給与収入",
      credit_sub_account: "",
      amount: data.gross_salary,
      description: `${prefix}給与`,
    });
  }

  return entries;
}
