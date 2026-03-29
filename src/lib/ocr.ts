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
    .replace(/[,、，.．]/g, "")
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
  text = normalizeOcrText(text);
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

/** OCRテキストの前処理（余分なスペース除去） */
function normalizeOcrText(text: string): string {
  let result = text;
  // 日本語文字・数字間のスペースを繰り返し除去
  const jp = "\\u3000-\\u9FFF\\uF900-\\uFAFF\\u30A0-\\u30FF\\u3040-\\u309F";
  const patterns = [
    new RegExp(`([${jp}])\\s+([${jp}])`, "g"),
    /(\d)\s+(\d)/g,
    new RegExp(`([${jp}])\\s+(\\d)`, "g"),
    new RegExp(`(\\d)\\s+([${jp}])`, "g"),
  ];
  // 複数パスで除去（「令 和 8 年」→「令和 8年」→「令和8年」）
  for (let i = 0; i < 5; i++) {
    const prev = result;
    for (const p of patterns) {
      result = result.replace(p, "$1$2");
    }
    if (result === prev) break;
  }
  return result;
}

/** 給与明細のOCRテキストからデータ抽出（パターンマッチ） */
export function parseSalarySlip(text: string): ParsedSalarySlip {
  text = normalizeOcrText(text);
  const result: ParsedSalarySlip = {};

  // 勤務先名（病院名・会社名）
  // 「〇〇病院」「〇〇クリニック」「〇〇医院」「株式会社〇〇」「〇〇法人」等
  const employerPatterns = [
    /(?:医療法人|社会医療法人|社会福祉法人|独立行政法人).{0,30}?(?:病院|クリニック|医院|診療所)/,
    /(?:医療法人|社会医療法人|社会福祉法人|独立行政法人).{2,20}/,
    /.{2,15}(?:病院|クリニック|医院|診療所)/,
    /(?:株式会社|有限会社|合同会社).{2,20}/,
    /.{2,15}(?:株式会社|有限会社|合同会社)/,
  ];
  for (const pattern of employerPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.employer_name = match[0].trim();
      break;
    }
  }

  // 支給日・支給月
  const payDateMatch = text.match(/支給日?令和(\d+)年(\d+)月(\d+)日/);
  if (payDateMatch) {
    const year = 2018 + parseInt(payDateMatch[1]);
    const month = payDateMatch[2].padStart(2, "0");
    const day = payDateMatch[3].padStart(2, "0");
    result.payment_month = `${year}/${month}/${day}`;
  } else {
    // 「〇月分給与」パターン
    const monthMatch = text.match(/(令和\d+年\d+月|\d{4}[年\/\-]\d{1,2}月?)/);
    if (monthMatch) {
      result.payment_month = parseDate(monthMatch[1]) || undefined;
    }
  }

  // 総支給額（「基本給」「合計」の金額から推定）
  const grossPatterns = [
    /(?:総支給|支給合計|給与総額)[\s\S]{0,20}?([０-９0-9,，.]{3,})/,
    /基本給[\s\S]{0,20}?([０-９0-9,，.]{3,})/,
    /合\s*計[\s\S]{0,10}?([０-９0-9,，.]{5,})/,
  ];
  for (const p of grossPatterns) {
    const m = text.match(p);
    if (m) {
      const amount = parseAmount(m[1]);
      if (amount && amount >= 10000) {
        result.gross_salary = amount;
        break;
      }
    }
  }

  // 所得税
  const taxMatch = text.match(/所得税[\s\S]{0,20}?([０-９0-9,，.]{3,})/);
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
  const netMatch = text.match(/(?:差引支給|振込支給|手取|振込額)[\s\S]{0,20}?([０-９0-9,，.]{3,})/);
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
