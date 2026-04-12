/**
 * 通帳取引から仕訳を生成
 * 除外ルール・勘定科目マッピング付き
 * 期首: 12月
 */

import { v4 as uuidv4 } from "uuid";

export interface BankTransaction {
  date: string;
  description: string;
  withdrawal: number;
  deposit: number;
  balance: number;
}

export interface BankJournalEntry {
  id: string;
  date: string;
  debit_account: string;
  debit_sub_account: string;
  credit_account: string;
  credit_sub_account: string;
  amount: number;
  description: string;
}

export interface BankTransactionWithRule {
  transaction: BankTransaction;
  action: "journal" | "skip";
  skip_reason?: string;
  journal?: BankJournalEntry;
  journals?: BankJournalEntry[]; // 社保等の複数仕訳
}

// 社会保険料の内訳（初回設定後は固定、料率変更時に修正）
const SOCIAL_INSURANCE = {
  company_share: 11294,   // 法定福利費（会社負担）
  employee_share: 10978,  // 預り金（従業員負担）
};

function generateSocialInsuranceJournals(t: BankTransaction): BankJournalEntry[] {
  const total = t.withdrawal;
  const company = SOCIAL_INSURANCE.company_share;
  const employee = SOCIAL_INSURANCE.employee_share;

  return [
    {
      id: uuidv4(),
      date: t.date,
      debit_account: "法定福利費",
      debit_sub_account: "",
      credit_account: "普通預金",
      credit_sub_account: "",
      amount: total,
      description: "社会保険料 引落",
    },
    {
      id: uuidv4(),
      date: t.date,
      debit_account: "未払費用",
      debit_sub_account: "",
      credit_account: "法定福利費",
      credit_sub_account: "",
      amount: company,
      description: "社会保険料 会社負担分振替",
    },
    {
      id: uuidv4(),
      date: t.date,
      debit_account: "預り金",
      debit_sub_account: "",
      credit_account: "法定福利費",
      credit_sub_account: "",
      amount: employee,
      description: "社会保険料 従業員負担分振替",
    },
  ];
}

// 除外ルール（摘要に含まれるキーワード）
const SKIP_RULES: { keywords: string[]; reason: string }[] = [
  { keywords: ["タイコ", "ﾀｲｺ", "大興", "ﾀｲｺｳ", "タイコウ"], reason: "管理会社入金（WealthPark処理済み）" },
  { keywords: ["UC"], reason: "カード引落（カード連携済み）" },
  // RKS（ギガプライズ）はオーシャンハイツのインターネット代なので仕訳対象
  { keywords: ["ミツイスミトモカード", "ﾐﾂｲｽﾐﾄﾓ", "ミツイストEカード", "ﾐﾂｲｽﾄ", "ミツイスト", "ミツイスミト", "ﾐﾂｲｽﾐﾄ"], reason: "カード引落（カード連携済み）" },
];

// 仕訳ルール（摘要キーワード → 勘定科目）
const JOURNAL_RULES: {
  keywords: string[];
  debit_account: string;
  credit_account: string;
  sub_account?: string;
  label: string;
}[] = [
  // 入金 - 産業医収入
  {
    keywords: ["ﾐﾔｻﾞｷｾﾝｶ", "ミヤサキセンカ", "ミヤザキセンカ", "宮崎千果", "ﾐﾔｻﾞｷ", "ミヤザキ", "ミヤサキ", "ｷｾﾝﾉﾘ", "ｷﾋﾟｶﾌ", "ｾﾝｶ", "ｾﾝﾘｮ", "ｷｾﾝ"],
    debit_account: "普通預金",
    credit_account: "産業医収入",
    sub_account: "宮崎千果",
    label: "産業医収入",
  },
  // 出金 - ローン返済・利息（金額で物件を判別するため特殊処理）
  {
    keywords: ["返済元金", "ﾍﾝｻｲ元金", "ヘンサイ元金"],
    debit_account: "__loan_repayment__",
    credit_account: "普通預金",
    label: "借入金返済（元金）",
  },
  {
    keywords: ["約定利息", "ﾔｸﾃｲ利息", "ヤクテイ利息"],
    debit_account: "__loan_interest__",
    credit_account: "普通預金",
    label: "借入金利息",
  },
  // 出金 - 定期積金（金額で物件を判別）
  {
    keywords: ["定積", "ﾃｲｷ", "テイキ"],
    debit_account: "__teiki__",
    credit_account: "普通預金",
    label: "定期積金",
  },
  // 出金 - 社会保険料（複数仕訳を生成）
  {
    keywords: ["ホケン", "ﾎｹﾝ", "保険", "ｼｬｶｲﾎｹﾝ", "ヨコサイ", "ﾖｺｻｲ", "ｺｻｲ", "シリコウ", "ｼﾘｺｳ", "ウシリコウ", "ホウシリコウ", "ボウシリコウ"],
    debit_account: "__social_insurance__",
    credit_account: "普通預金",
    label: "社会保険料",
  },
  // 出金 - インターネット（オーシャンハイツ桜ヶ丘）
  {
    keywords: ["RKS", "ギガプライズ", "ｷﾞｶﾞﾌﾟﾗｲｽﾞ", "ｷ*ｶ*ｱﾌﾟﾗｲｽ"],
    debit_account: "通信費",
    credit_account: "普通預金",
    sub_account: "オーシャンハイツ桜ヶ丘",
    label: "インターネット代",
  },
  // 出金 - インターネット（祇園KAWANOビルⅢ）
  {
    keywords: ["SMBC", "ｲﾝﾀｰﾈｯﾄ", "インターネット"],
    debit_account: "通信費",
    credit_account: "普通預金",
    sub_account: "祇園KAWANOビルⅢ",
    label: "通信費",
  },
  // 入金 - 受取利息
  {
    keywords: ["利息", "ﾘｿｸ", "お利息"],
    debit_account: "普通預金",
    credit_account: "受取利息",
    label: "受取利息",
  },
  // 出金 - 法人税・住民税・事業税
  {
    keywords: ["法人税", "ﾎｳｼﾞﾝｾﾞｲ", "住民税", "事業税", "窓口収納代金", "窓口収納"],
    debit_account: "法人税等",
    credit_account: "普通預金",
    label: "法人税等",
  },
  // 出金 - 税理士報酬（源泉差引後の振込額のみ。報酬額・源泉額は請求書で確認）
  {
    keywords: ["ZHP", "ｾﾞｲﾘｼ", "税理士", "ﾎｳｼｭｳ", "インボウシウ", "ｲﾝﾎﾞｳｼｳ"],
    debit_account: "支払報酬",
    credit_account: "普通預金",
    label: "税理士報酬（源泉差引後）",
  },
  // 出金 - 振込手数料
  {
    keywords: ["振込手数料", "ﾌﾘｺﾐﾃｽｳﾘｮｳ", "手数料"],
    debit_account: "支払手数料",
    credit_account: "普通預金",
    label: "振込手数料",
  },
  // 出金 - 振込（資金移動等）
  {
    keywords: ["振込資金", "ﾌﾘｺﾐｼｷﾝ"],
    debit_account: "普通預金",
    credit_account: "普通預金",
    label: "資金移動",
  },
];

function matchesKeywords(description: string, keywords: string[]): boolean {
  const cleaned = cleanDescription(description).toUpperCase();
  return keywords.some((kw) => cleaned.includes(kw.toUpperCase()));
}

/** 摘要から先頭の金額混入を除去 */
function cleanDescription(desc: string): string {
  return desc.replace(/^[\d,]+/, "").trim();
}

const BANK_SUB_ACCOUNT = "宮崎太陽銀行";
const BANK_SUB_KAWANO = "宮崎太陽銀行(祇園kawano)";
const BANK_SUB_OCEAN = "宮崎太陽銀行(オーシャン)";

/** 普通預金の補助科目を設定 */
function setBankSubAccount(journal: BankJournalEntry): BankJournalEntry {
  if (journal.debit_account === "普通預金") {
    journal.debit_sub_account = BANK_SUB_ACCOUNT;
  }
  if (journal.credit_account === "普通預金") {
    journal.credit_sub_account = BANK_SUB_ACCOUNT;
  }
  return journal;
}

/** 重複取引を除外 */
function deduplicateTransactions(transactions: BankTransaction[]): BankTransaction[] {
  const seen = new Set<string>();
  return transactions.filter((t) => {
    const key = `${t.date}_${t.withdrawal}_${t.deposit}_${t.balance}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** 通帳取引を仕訳ルールに照合 */
export function processBankTransactions(
  transactions: BankTransaction[],
  startDate?: string
): BankTransactionWithRule[] {
  const deduplicated = deduplicateTransactions(transactions);
  return deduplicated
    .filter((t) => !startDate || t.date >= startDate)
    .map((t) => {
      // 除外チェック（金額混入を除去してからマッチ）
      const cleaned = cleanDescription(t.description);
      for (const rule of SKIP_RULES) {
        if (matchesKeywords(cleaned, rule.keywords) || matchesKeywords(t.description, rule.keywords)) {
          return { transaction: t, action: "skip" as const, skip_reason: rule.reason };
        }
      }

      // 仕訳ルールマッチ
      for (const rule of JOURNAL_RULES) {
        if (matchesKeywords(t.description, rule.keywords)) {
          // 定期積金は金額で物件を判別
          if (rule.debit_account === "__teiki__") {
            const amount = t.withdrawal;
            const prop = amount >= 100000 ? "オーシャン" : "祇園kawano";
            return {
              transaction: t,
              action: "journal" as const,
              journal: {
                id: uuidv4(),
                date: t.date,
                debit_account: "普通預金",
                debit_sub_account: prop,
                credit_account: "普通預金",
                credit_sub_account: BANK_SUB_ACCOUNT,
                amount,
                description: `定期積金 ${prop}`,
              },
            };
          }

          // ローン返済は金額で物件を判別（大きい方がオーシャンハイツ）
          if (rule.debit_account === "__loan_repayment__") {
            const amount = t.withdrawal;
            const prop = amount >= 200000 ? "オーシャンハイツ桜ヶ丘" : "祇園KAWANOビルⅢ";
            return {
              transaction: t,
              action: "journal" as const,
              journal: setBankSubAccount({
                id: uuidv4(),
                date: t.date,
                debit_account: "長期借入金",
                debit_sub_account: prop,
                credit_account: "普通預金",
                credit_sub_account: "",
                amount,
                description: `借入金返済（元金） ${prop}`,
              }),
            };
          }

          // 約定利息は金額で物件を判別
          if (rule.debit_account === "__loan_interest__") {
            const amount = t.withdrawal;
            const prop = amount >= 200000 ? "オーシャンハイツ桜ヶ丘" : "祇園KAWANOビルⅢ";
            return {
              transaction: t,
              action: "journal" as const,
              journal: setBankSubAccount({
                id: uuidv4(),
                date: t.date,
                debit_account: "支払利息",
                debit_sub_account: prop,
                credit_account: "普通預金",
                credit_sub_account: "",
                amount,
                description: `借入金利息 ${prop}`,
              }),
            };
          }

          // 社会保険料は複数仕訳を生成
          if (rule.debit_account === "__social_insurance__") {
            return {
              transaction: t,
              action: "journal" as const,
              journals: generateSocialInsuranceJournals(t).map(setBankSubAccount),
            };
          }

          const amount = t.deposit > 0 ? t.deposit : t.withdrawal;
          return {
            transaction: t,
            action: "journal" as const,
            journal: setBankSubAccount({
              id: uuidv4(),
              date: t.date,
              debit_account: rule.debit_account,
              debit_sub_account: rule.sub_account || "",
              credit_account: rule.credit_account,
              credit_sub_account: "",
              amount,
              description: `${rule.label} ${cleanDescription(t.description)}`,
            }),
          };
        }
      }

      // マッチしない取引
      const amount = t.deposit > 0 ? t.deposit : t.withdrawal;
      // 入金で管理会社以外 → 産業医収入として処理
      if (t.deposit > 0) {
        return {
          transaction: t,
          action: "journal" as const,
          journal: setBankSubAccount({
            id: uuidv4(),
            date: t.date,
            debit_account: "普通預金",
            debit_sub_account: "",
            credit_account: "産業医収入",
            credit_sub_account: "",
            amount,
            description: `産業医収入 ${cleanDescription(t.description)}`,
          }),
        };
      }
      // 出金 → 要確認
      return {
        transaction: t,
        action: "journal" as const,
        journal: setBankSubAccount({
          id: uuidv4(),
          date: t.date,
          debit_account: "【要確認】",
          debit_sub_account: "",
          credit_account: "普通預金",
          credit_sub_account: "",
          amount,
          description: cleanDescription(t.description),
        }),
      };
    });
}
