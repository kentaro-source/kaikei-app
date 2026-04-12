/**
 * WealthPark月次収支報告書PDFからデータを抽出
 * テキストベースPDFなのでpdf-parseで直接抽出
 * 金額はすべて税込み（インボイス未登録のため）
 */

export interface WealthParkProperty {
  property_name: string;
  settlement_month: string;
  income: {
    rent: number;
    common_fee: number;
    parking: number;
    other: number;
    total: number;
  };
  expense: {
    items: { name: string; amount: number }[];
    total: number;
  };
  transfer_amount: number;
}

export interface WealthParkReport {
  owner_name: string;
  management_company: string;
  month: string;
  properties: WealthParkProperty[];
}

export interface TenantEntry {
  property_name: string;
  room: string;
  tenant_name: string;
  month: string;
  total: number;
}

function parseNum(s: string): number {
  return parseInt(s.replace(/,/g, ""), 10) || 0;
}

/** 収入明細ページから入居者情報を抽出 */
function parseTenantPage(pageText: string, month: string): TenantEntry[] {
  if (!pageText.includes("保有物件の収入明細")) return [];

  const nameMatch = pageText.match(/大興土地建物管理\n(.+?)\n/);
  if (!nameMatch) return [];
  const propertyName = nameMatch[1].trim();
  if (EXCLUDED_PROPERTIES.some((ex) => propertyName.includes(ex))) return [];

  const tenants: TenantEntry[] = [];
  // 「部屋 契約者 対象月 ... 合計」の行をパース
  const lines = pageText.split("\n");
  for (const line of lines) {
    // 部屋番号(3桁)で始まる行を探す
    const m = line.match(/^(\d{3})\s*(.+?)\s*(\d{4}\/\d{2})\s*([\d,]+(?:\s+[\d,]+)*)\s*$/);
    if (!m) continue;

    const room = m[1];
    const tenant = m[2].trim();
    // 合計は行末の数値
    const nums = m[4].match(/[\d,]+/g) || [];
    const total = nums.length > 0 ? parseNum(nums[nums.length - 1]) : 0;

    if (tenant && total > 0 && !tenant.includes("収入合計")) {
      tenants.push({
        property_name: normalizePropertyName(propertyName),
        room,
        tenant_name: tenant,
        month,
        total,
      });
    }
  }

  return tenants;
}

/** PDFテキストから全物件の入居者情報を抽出 */
export function extractTenants(text: string, month: string): TenantEntry[] {
  const pages = text.split(/\n\d+\n/);
  const allTenants: TenantEntry[] = [];
  for (const page of pages) {
    allTenants.push(...parseTenantPage(page, month));
  }
  return allTenants;
}

// ========== 年次収支報告書パーサー ==========

export interface WealthParkMonthlyData {
  month: number; // 1-12
  income: {
    rent: number;
    common_fee: number;
    parking: number;
    other: number;
    total: number;
  };
  expense: {
    items: { name: string; amount: number }[];
    total: number;
  };
  transfer_amount: number;
}

export interface WealthParkAnnualProperty {
  property_name: string;
  year: number;
  months: WealthParkMonthlyData[];
}

export interface WealthParkAnnualReport {
  owner_name: string;
  management_company: string;
  year: number;
  properties: WealthParkAnnualProperty[];
}

/** 月別カラムのデータ行をパース */
function parseMonthlyRow(line: string): { name: string; values: number[] } | null {
  // 「項目名 数値 数値 ... 年計」形式
  // 空セルは空白になっている
  const match = line.match(/^(.+?)([\d,]+(?:\s+[\d,]*)*)\s*$/);
  if (!match) return null;

  const name = match[1].trim();
  if (!name || name.includes("項目名")) return null;

  // 数値部分を分割（カンマ付き数値を考慮）
  const numStr = match[2];
  const values: number[] = [];
  const numPattern = /([\d,]+)/g;
  let m;
  while ((m = numPattern.exec(numStr)) !== null) {
    values.push(parseNum(m[1]));
  }

  return { name, values };
}

/** 年次PDFテキストから物件ごと・月ごとのデータを抽出 */
export function parseWealthParkAnnualPdf(text: string): WealthParkAnnualReport {
  const report: WealthParkAnnualReport = {
    owner_name: "",
    management_company: "",
    year: 0,
    properties: [],
  };

  const ownerMatch = text.match(/(.+?)様/);
  if (ownerMatch) report.owner_name = ownerMatch[1].trim();

  const mgmtMatch = text.match(/様\n(.+?)\n/);
  if (mgmtMatch) report.management_company = mgmtMatch[1].trim();

  const yearMatch = text.match(/年次収支報告書\s*-\s*(\d{4})年度/);
  if (yearMatch) report.year = parseInt(yearMatch[1]);

  const pages = text.split(/\n\d+\n/);

  for (const page of pages) {
    if (!page.includes("保有物件の収入‧支出情報")) continue;

    const nameMatch = page.match(/大興土地建物管理\n(.+?)\n/);
    if (!nameMatch) continue;
    const propertyName = nameMatch[1].trim();
    if (propertyName.includes("全保有物件")) continue;

    const annualProp: WealthParkAnnualProperty = {
      property_name: normalizePropertyName(propertyName),
      year: report.year,
      months: [],
    };

    // 収入セクション
    const incomeSection = page.match(/収入\n([\s\S]*?)収入合計/);
    const incomeLines: Record<string, number[]> = {};
    if (incomeSection) {
      for (const line of incomeSection[1].split("\n")) {
        const parsed = parseMonthlyRow(line);
        if (parsed && parsed.values.length > 0) {
          // 正規化
          const key = parsed.name.replace(/\s/g, "");
          incomeLines[key] = parsed.values;
        }
      }
    }

    // 収入合計行
    const incTotalMatch = page.match(/収入合計([\d,\s]+)/);
    const incTotals: number[] = [];
    if (incTotalMatch) {
      const nums = incTotalMatch[1].match(/[\d,]+/g) || [];
      for (const n of nums) incTotals.push(parseNum(n));
    }

    // 支出セクション
    const expenseSection = page.match(/支出\n([\s\S]*?)支出合計/);
    const expenseLines: { name: string; values: number[] }[] = [];
    if (expenseSection) {
      for (const line of expenseSection[1].split("\n")) {
        const parsed = parseMonthlyRow(line);
        if (parsed && parsed.values.length > 0) {
          const skip = ["その他合計"];
          if (!skip.some(s => parsed.name.includes(s))) {
            expenseLines.push(parsed);
          }
        }
      }
    }

    // 支出合計行
    const expTotalMatch = page.match(/支出合計([\d,\s]+)/);
    const expTotals: number[] = [];
    if (expTotalMatch) {
      const nums = expTotalMatch[1].match(/[\d,]+/g) || [];
      for (const n of nums) expTotals.push(parseNum(n));
    }

    // 月ごとのデータを構築（最大12ヶ月、最後の値は年計なので除外）
    const monthCount = Math.min(incTotals.length - 1, 12); // 最後は年計
    for (let m = 0; m < monthCount; m++) {
      if (incTotals[m] === 0 && expTotals[m] === 0) continue; // データなし月はスキップ

      const monthData: WealthParkMonthlyData = {
        month: m + 1,
        income: {
          rent: (incomeLines["賃貸料"] || [])[m] || 0,
          common_fee: (incomeLines["共益費"] || [])[m] || 0,
          parking: (incomeLines["駐車料"] || [])[m] || 0,
          other: (incomeLines["その他"] || [])[m] || 0,
          total: incTotals[m] || 0,
        },
        expense: {
          items: expenseLines
            .filter(e => (e.values[m] || 0) > 0)
            .map(e => ({ name: e.name, amount: e.values[m] || 0 })),
          total: expTotals[m] || 0,
        },
        transfer_amount: (incTotals[m] || 0) - (expTotals[m] || 0),
      };

      annualProp.months.push(monthData);
    }

    report.properties.push(annualProp);
  }

  return report;
}

// 除外する物件名
const EXCLUDED_PROPERTIES = ["グリーンゲーブルズ"];

// PDF物件名 → 弥生補助科目名の変換
const PROPERTY_NAME_MAP: Record<string, string> = {
  "祇園ＫＡＷＡＮＯビルIII": "祇園kawanoビルⅢ",
  "祇園KAWANOビルIII": "祇園kawanoビルⅢ",
  "祇園KAWANOビルⅢ": "祇園kawanoビルⅢ",
  "オーシャンハイツ桜ヶ丘": "オーシャンハイツ",
};

function normalizePropertyName(name: string): string {
  return PROPERTY_NAME_MAP[name] || name;
}

/** 1ページ分のテキストから物件データを抽出 */
function parsePropertyPage(pageText: string, month: string): WealthParkProperty | null {
  // 「保有物件の収入‧支出情報」を含むページのみ処理
  if (!pageText.includes("保有物件の収入‧支出情報")) return null;

  // 物件名を抽出（「株式会社 大興土地建物管理」の次の行）
  const nameMatch = pageText.match(/大興土地建物管理\n(.+?)\n/);
  if (!nameMatch) return null;
  const propertyName = nameMatch[1].trim();
  if (propertyName.includes("全保有物件")) return null;
  if (EXCLUDED_PROPERTIES.some((ex) => propertyName.includes(ex))) return null;

  const property: WealthParkProperty = {
    property_name: normalizePropertyName(propertyName),
    settlement_month: month,
    income: { rent: 0, common_fee: 0, parking: 0, other: 0, total: 0 },
    expense: { items: [], total: 0 },
    transfer_amount: 0,
  };

  // 収入
  const rentMatch = pageText.match(/賃\s*貸\s*料([\d,]+)/);
  if (rentMatch) property.income.rent = parseNum(rentMatch[1]);

  const commonMatch = pageText.match(/共\s*益\s*費([\d,]+)/);
  if (commonMatch) property.income.common_fee = parseNum(commonMatch[1]);

  const parkingMatch = pageText.match(/駐車料([\d,]+)/);
  if (parkingMatch) property.income.parking = parseNum(parkingMatch[1]);

  // その他（「その他合計」や「その他入金」は除外）
  const otherMatch = pageText.match(/^その他(?!合計|入金|出金)([\d,]+)/m);
  if (otherMatch) property.income.other = parseNum(otherMatch[1]);

  const incTotalMatch = pageText.match(/収入合計([\d,]+)/);
  if (incTotalMatch) property.income.total = parseNum(incTotalMatch[1]);

  // 支出（「収入合計」と「支出合計」の間の行を抽出）
  const expSection = pageText.match(/収入合計[\d,]+\n支出\n([\s\S]*?)支出合計([\d,]+)/);
  if (expSection) {
    const lines = expSection[1].split("\n");
    for (const line of lines) {
      const m = line.trim().match(/^(.+?)([\d,]+)\s*$/);
      if (m) {
        const name = m[1].trim();
        const amount = parseNum(m[2]);
        if (amount > 0 && name.length > 0) {
          property.expense.items.push({ name, amount });
        }
      }
    }
    property.expense.total = parseNum(expSection[2]);
  }

  // 送金額
  property.transfer_amount = property.income.total - property.expense.total;

  return property;
}

export function parseWealthParkPdf(text: string): WealthParkReport {
  const report: WealthParkReport = {
    owner_name: "",
    management_company: "",
    month: "",
    properties: [],
  };

  // オーナー名
  const ownerMatch = text.match(/(.+?)様/);
  if (ownerMatch) report.owner_name = ownerMatch[1].trim();

  // 管理会社名
  const mgmtMatch = text.match(/様\n(.+?)\n/);
  if (mgmtMatch) report.management_company = mgmtMatch[1].trim();

  // 精算月
  const monthMatch = text.match(/月次収支報告書\s*-\s*(\d{4})年(\d{1,2})月分/);
  if (monthMatch) {
    report.month = `${monthMatch[1]}/${monthMatch[2].padStart(2, "0")}`;
  }

  // ページ番号で分割（各ページの末尾は「\n数字\n」）
  const pages = text.split(/\n\d+\n/);

  for (const page of pages) {
    const property = parsePropertyPage(page, report.month);
    if (property) {
      report.properties.push(property);
    }
  }

  return report;
}
