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
  { keywords: ["タイコウ", "ﾀｲｺｳ", "大興"], reason: "管理会社入金（WealthPark処理済み）" },
  { keywords: ["UC"], reason: "カード引落（カード連携済み）" },
  // RKS（ギガプライズ）はオーシャンハイツのインターネット代なので仕訳対象
  { keywords: ["ミツイスミトモカード", "ﾐﾂｲｽﾐﾄﾓ"], reason: "カード引落（カード連携済み）" },
];

// 仕訳ルール（摘要キーワード → 勘定科目）
const JOURNAL_RULES: {
  keywords: string[];
  debit_account: string;
  credit_account: string;
  sub_account?: string;
  label: string;
}[] = [
  // 入金
  {
    keywords: ["ﾐﾔｻﾞｷｾﾝｶ", "ミヤサキセンカ", "ミヤザキセンカ", "宮崎千果"],
    debit_account: "普通預金",
    credit_account: "産業医収入",
    label: "産業医収入",
  },
  // 出金 - ローン返済
  {
    keywords: ["返済元金", "ﾍﾝｻｲ元金", "ヘンサイ元金"],
    debit_account: "長期借入金",
    credit_account: "普通預金",
    label: "借入金返済（元金）",
  },
  {
    keywords: ["約定利息", "ﾔｸﾃｲ利息", "ヤクテイ利息"],
    debit_account: "支払利息",
    credit_account: "普通預金",
    label: "借入金利息",
  },
  // 出金 - 定期積金
  {
    keywords: ["定積", "ﾃｲｷ", "テイキ"],
    debit_account: "定期積金",
    credit_account: "普通預金",
    label: "定期積金",
  },
  // 出金 - 社会保険料（複数仕訳を生成）
  {
    keywords: ["ホケン", "ﾎｹﾝ", "保険", "ｼｬｶｲﾎｹﾝ"],
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
  // 出金 - インターネット
  {
    keywords: ["SMBC", "ｲﾝﾀｰﾈｯﾄ", "インターネット"],
    debit_account: "通信費",
    credit_account: "普通預金",
    label: "通信費",
  },
];

function matchesKeywords(description: string, keywords: string[]): boolean {
  const upper = description.toUpperCase();
  return keywords.some((kw) => upper.includes(kw.toUpperCase()));
}

/** 通帳取引を仕訳ルールに照合 */
export function processBankTransactions(
  transactions: BankTransaction[],
  startDate?: string
): BankTransactionWithRule[] {
  return transactions
    .filter((t) => !startDate || t.date >= startDate)
    .map((t) => {
      // 除外チェック
      for (const rule of SKIP_RULES) {
        if (matchesKeywords(t.description, rule.keywords)) {
          return { transaction: t, action: "skip" as const, skip_reason: rule.reason };
        }
      }

      // 仕訳ルールマッチ
      for (const rule of JOURNAL_RULES) {
        if (matchesKeywords(t.description, rule.keywords)) {
          // 社会保険料は複数仕訳を生成
          if (rule.debit_account === "__social_insurance__") {
            return {
              transaction: t,
              action: "journal" as const,
              journals: generateSocialInsuranceJournals(t),
            };
          }

          const amount = t.deposit > 0 ? t.deposit : t.withdrawal;
          return {
            transaction: t,
            action: "journal" as const,
            journal: {
              id: uuidv4(),
              date: t.date,
              debit_account: rule.debit_account,
              debit_sub_account: rule.sub_account || "",
              credit_account: rule.credit_account,
              credit_sub_account: "",
              amount,
              description: `${rule.label} ${t.description}`,
            },
          };
        }
      }

      // マッチしない取引 → 不明として仕訳生成（手動で科目設定）
      const amount = t.deposit > 0 ? t.deposit : t.withdrawal;
      return {
        transaction: t,
        action: "journal" as const,
        journal: {
          id: uuidv4(),
          date: t.date,
          debit_account: t.deposit > 0 ? "普通預金" : "【要確認】",
          debit_sub_account: "",
          credit_account: t.deposit > 0 ? "【要確認】" : "普通預金",
          credit_sub_account: "",
          amount,
          description: t.description,
        },
      };
    });
}
