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

  // 電気料金
  if (data.electricity) {
    entries.push({
      id: uuidv4(),
      date: month,
      debit_account: "水道光熱費",
      debit_sub_account: "",
      credit_account: "賃貸料",
      credit_sub_account: "",
      amount: data.electricity,
      description: `${prefix}電気料金`,
    });
  }

  // 管理手数料（税抜）
  if (data.management_fee) {
    entries.push({
      id: uuidv4(),
      date: month,
      debit_account: "管理費",
      debit_sub_account: "",
      credit_account: "賃貸料",
      credit_sub_account: "",
      amount: data.management_fee,
      description: `${prefix}管理手数料`,
    });
  }

  // 管理手数料の消費税
  if (data.management_fee_tax) {
    entries.push({
      id: uuidv4(),
      date: month,
      debit_account: "仮払消費税",
      debit_sub_account: "",
      credit_account: "賃貸料",
      credit_sub_account: "",
      amount: data.management_fee_tax,
      description: `${prefix}管理手数料 消費税`,
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
