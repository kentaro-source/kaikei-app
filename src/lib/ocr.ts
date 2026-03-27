import { TemplateRegion } from "./db";

export interface OcrFieldResult {
  field_name: string;
  label: string;
  value: string;
  confidence: number;
}

export interface ParsedRentStatement {
  property_name?: string;
  settlement_month?: string;
  rent_income?: number;
  management_fee?: number;
  repair_reserve?: number;
  transfer_amount?: number;
  vacancy_count?: number;
  other_deductions?: { name: string; amount: number }[];
}

export interface ParsedSalarySlip {
  employer_name?: string;
  payment_month?: string;
  gross_salary?: number;
  income_tax?: number;
  resident_tax?: number;
  social_insurance?: number;
  net_salary?: number;
}

/** 金額文字列をパース (カンマ除去、全角→半角) */
export function parseAmount(text: string): number | null {
  if (!text) return null;
  const normalized = text
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[,、，]/g, "")
    .replace(/[円¥￥]/g, "")
    .replace(/[\s\u3000]/g, "")
    .replace(/[▲△\-ー−]/g, "-");
  const match = normalized.match(/-?\d+/);
  return match ? parseInt(match[0], 10) : null;
}

/** 日付文字列をパース */
export function parseDate(text: string): string | null {
  if (!text) return null;
  const normalized = text
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[\s\u3000]/g, "");

  // 令和X年Y月 形式
  const reReiwa = normalized.match(/令和(\d+)年(\d+)月/);
  if (reReiwa) {
    const year = 2018 + parseInt(reReiwa[1]);
    const month = reReiwa[2].padStart(2, "0");
    return `${year}/${month}/01`;
  }

  // YYYY年MM月 形式
  const reJp = normalized.match(/(\d{4})年(\d{1,2})月/);
  if (reJp) {
    return `${reJp[1]}/${reJp[2].padStart(2, "0")}/01`;
  }

  // YYYY/MM or YYYY-MM
  const reSlash = normalized.match(/(\d{4})[\/\-](\d{1,2})/);
  if (reSlash) {
    return `${reSlash[1]}/${reSlash[2].padStart(2, "0")}/01`;
  }

  return null;
}

/** 家賃精算書のOCRテキストからデータ抽出（パターンマッチ） */
export function parseRentStatement(text: string): ParsedRentStatement {
  const result: ParsedRentStatement = {};

  // 精算月
  const monthMatch = text.match(/(令和\d+年\d+月|\d{4}[年\/\-]\d{1,2}月?).*?(精算|報告|収支)/);
  if (monthMatch) {
    result.settlement_month = parseDate(monthMatch[1]) || undefined;
  }

  // 家賃収入
  const rentMatch = text.match(/(?:家賃|賃料|賃貸料)[\s\S]{0,30}?([０-９0-9,，]+)/);
  if (rentMatch) {
    result.rent_income = parseAmount(rentMatch[1]) || undefined;
  }

  // 管理費
  const mgmtMatch = text.match(/(?:管理費|管理料|管理手数料)[\s\S]{0,30}?([０-９0-9,，]+)/);
  if (mgmtMatch) {
    result.management_fee = parseAmount(mgmtMatch[1]) || undefined;
  }

  // 修繕積立金
  const repairMatch = text.match(/(?:修繕|積立)[\s\S]{0,30}?([０-９0-9,，]+)/);
  if (repairMatch) {
    result.repair_reserve = parseAmount(repairMatch[1]) || undefined;
  }

  // 振込額
  const transferMatch = text.match(/(?:振込|送金|お支払|差引)[\s\S]{0,30}?([０-９0-9,，]+)/);
  if (transferMatch) {
    result.transfer_amount = parseAmount(transferMatch[1]) || undefined;
  }

  return result;
}

/** 給与明細のOCRテキストからデータ抽出（パターンマッチ） */
export function parseSalarySlip(text: string): ParsedSalarySlip {
  const result: ParsedSalarySlip = {};

  // 総支給額
  const grossMatch = text.match(/(?:総支給|支給合計|給与総額)[\s\S]{0,30}?([０-９0-9,，]+)/);
  if (grossMatch) {
    result.gross_salary = parseAmount(grossMatch[1]) || undefined;
  }

  // 所得税
  const taxMatch = text.match(/(?:所得税|源泉)[\s\S]{0,30}?([０-９0-9,，]+)/);
  if (taxMatch) {
    result.income_tax = parseAmount(taxMatch[1]) || undefined;
  }

  // 住民税
  const residentMatch = text.match(/(?:住民税|市民税|都民税)[\s\S]{0,30}?([０-９0-9,，]+)/);
  if (residentMatch) {
    result.resident_tax = parseAmount(residentMatch[1]) || undefined;
  }

  // 社会保険料
  const socialMatch = text.match(/(?:社会保険|健康保険|厚生年金)[\s\S]{0,30}?([０-９0-9,，]+)/);
  if (socialMatch) {
    result.social_insurance = parseAmount(socialMatch[1]) || undefined;
  }

  // 差引支給額
  const netMatch = text.match(/(?:差引支給|手取|振込額)[\s\S]{0,30}?([０-９0-9,，]+)/);
  if (netMatch) {
    result.net_salary = parseAmount(netMatch[1]) || undefined;
  }

  return result;
}

/** テンプレート領域を使ったフィールド単位のOCR結果解析 */
export function applyTemplateToOcrResults(
  regions: TemplateRegion[],
  fieldResults: OcrFieldResult[]
): ParsedRentStatement {
  const result: ParsedRentStatement = {};
  for (const field of fieldResults) {
    const amount = parseAmount(field.value);
    switch (field.field_name) {
      case "property_name":
        result.property_name = field.value;
        break;
      case "settlement_month":
        result.settlement_month = parseDate(field.value) || field.value;
        break;
      case "rent_income":
        result.rent_income = amount || undefined;
        break;
      case "management_fee":
        result.management_fee = amount || undefined;
        break;
      case "repair_reserve":
        result.repair_reserve = amount || undefined;
        break;
      case "transfer_amount":
        result.transfer_amount = amount || undefined;
        break;
    }
  }
  return result;
}
