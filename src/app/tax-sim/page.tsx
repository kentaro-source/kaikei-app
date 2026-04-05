"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SalaryEntry {
  id: string;
  employer: string;
  date: string;
  taxable_salary: number;
  income_tax: number;
}

// 所得税率テーブル（2024年現在）
const TAX_BRACKETS = [
  { limit: 1950000, rate: 0.05, deduction: 0 },
  { limit: 3300000, rate: 0.10, deduction: 97500 },
  { limit: 6950000, rate: 0.20, deduction: 427500 },
  { limit: 9000000, rate: 0.23, deduction: 636000 },
  { limit: 18000000, rate: 0.33, deduction: 1536000 },
  { limit: 40000000, rate: 0.40, deduction: 2796000 },
  { limit: Infinity, rate: 0.45, deduction: 4796000 },
];

function calcIncomeTax(taxableIncome: number): number {
  if (taxableIncome <= 0) return 0;
  for (const bracket of TAX_BRACKETS) {
    if (taxableIncome <= bracket.limit) {
      return Math.floor(taxableIncome * bracket.rate - bracket.deduction);
    }
  }
  return 0;
}

// 給与所得控除
function calcSalaryDeduction(totalSalary: number): number {
  if (totalSalary <= 1625000) return 550000;
  if (totalSalary <= 1800000) return Math.floor(totalSalary * 0.4 - 100000);
  if (totalSalary <= 3600000) return Math.floor(totalSalary * 0.3 + 80000);
  if (totalSalary <= 6600000) return Math.floor(totalSalary * 0.2 + 440000);
  if (totalSalary <= 8500000) return Math.floor(totalSalary * 0.1 + 1100000);
  return 1950000;
}

// ふるさと納税上限額（自己負担2,000円）
function calcFurusatoLimit(totalIncome: number, totalDeductions: number): number {
  const taxableIncome = Math.max(0, totalIncome - totalDeductions);
  if (taxableIncome <= 0) return 0;

  // 住民税所得割額（概算: 課税所得 × 10%）
  const residentTax = taxableIncome * 0.10;

  // 所得税率
  let taxRate = 0.05;
  for (const bracket of TAX_BRACKETS) {
    if (taxableIncome <= bracket.limit) {
      taxRate = bracket.rate;
      break;
    }
  }

  // 上限額 = 住民税所得割額 × 20% ÷ (100% - 10% - 所得税率 × 1.021) + 2000
  const limit = residentTax * 0.2 / (1 - 0.1 - taxRate * 1.021) + 2000;
  return Math.floor(limit);
}

export default function TaxSimPage() {
  const [salaryEntries, setSalaryEntries] = useState<SalaryEntry[]>([]);

  // 不動産所得
  const [realEstateProfit, setRealEstateProfit] = useState("");

  // 所得控除
  const [socialInsurance, setSocialInsurance] = useState("");
  const [lifeInsurance, setLifeInsurance] = useState("");
  const [earthquakeInsurance, setEarthquakeInsurance] = useState("");
  const [medicalExpense, setMedicalExpense] = useState("");
  const [ideco, setIdeco] = useState("");
  const [housingLoan, setHousingLoan] = useState("");

  const [loaded, setLoaded] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [salaryRes, simRes] = await Promise.all([
        fetch("/api/salary"),
        fetch("/api/tax-sim"),
      ]);
      const salaryData = await salaryRes.json();
      setSalaryEntries(salaryData.entries || []);

      const simData = await simRes.json();
      if (simData.data) {
        setRealEstateProfit(simData.data.real_estate_profit?.toString() || "");
        setSocialInsurance(simData.data.social_insurance?.toString() || "");
        setLifeInsurance(simData.data.life_insurance?.toString() || "");
        setEarthquakeInsurance(simData.data.earthquake_insurance?.toString() || "");
        setMedicalExpense(simData.data.medical_expense?.toString() || "");
        setIdeco(simData.data.ideco?.toString() || "");
        setHousingLoan(simData.data.housing_loan?.toString() || "");
      }
      setLoaded(true);
    } catch {}
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // 自動保存（値が変更されたとき）
  useEffect(() => {
    if (!loaded) return;
    const timer = setTimeout(() => {
      fetch("/api/tax-sim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year: 2025,
          real_estate_profit: num(realEstateProfit),
          social_insurance: num(socialInsurance),
          life_insurance: num(lifeInsurance),
          earthquake_insurance: num(earthquakeInsurance),
          medical_expense: num(medicalExpense),
          ideco: num(ideco),
          housing_loan: num(housingLoan),
        }),
      }).catch(() => {});
    }, 500);
    return () => clearTimeout(timer);
  }, [loaded, realEstateProfit, socialInsurance, lifeInsurance, earthquakeInsurance, medicalExpense, ideco, housingLoan]);

  const num = (s: string) => parseInt(s.replace(/,/g, "") || "0", 10);

  // 給与収入合計
  const totalSalary = salaryEntries.reduce((sum, e) => sum + e.taxable_salary, 0);
  // 給与所得控除
  const salaryDeduction = calcSalaryDeduction(totalSalary);
  // 所得金額調整控除（給与収入850万超の場合）
  const incomeAdjustment = totalSalary > 8500000
    ? Math.min(150000, (totalSalary - 8500000) * 0.1)
    : 0;
  // 給与所得
  const salaryIncome = Math.max(0, totalSalary - salaryDeduction - incomeAdjustment);

  // 不動産所得
  const realEstateProfitNum = num(realEstateProfit);

  // 総所得金額
  const totalIncome = salaryIncome + Math.max(0, realEstateProfitNum);

  // 所得控除合計
  const basicDeduction = 480000; // 基礎控除
  const totalDeductions =
    basicDeduction +
    num(socialInsurance) +
    num(lifeInsurance) +
    num(earthquakeInsurance) +
    num(medicalExpense) +
    num(ideco);

  // 課税所得
  const taxableIncome = Math.max(0, totalIncome - totalDeductions);

  // 所得税額（住宅ローン控除は税額控除）
  const incomeTaxBeforeCredit = calcIncomeTax(taxableIncome);
  const housingLoanCredit = num(housingLoan);
  const incomeTax = Math.max(0, incomeTaxBeforeCredit - housingLoanCredit);

  // 源泉徴収済み税額
  const withheldTax = salaryEntries.reduce((sum, e) => sum + e.income_tax, 0);

  // ふるさと納税上限
  const furusatoLimit = calcFurusatoLimit(totalIncome, totalDeductions);

  const fmt = (n: number) => n.toLocaleString();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">確定申告シミュレーション</h1>

      {/* 給与所得（自動） */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">給与所得</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
            <div>
              <span className="text-gray-500">給与収入</span>
              <div className="font-mono text-lg">{fmt(totalSalary)}</div>
            </div>
            <div>
              <span className="text-gray-500">給与所得控除</span>
              <div className="font-mono text-lg">-{fmt(salaryDeduction)}</div>
            </div>
            {incomeAdjustment > 0 && (
              <div>
                <span className="text-gray-500">所得金額調整控除</span>
                <div className="font-mono text-lg">-{fmt(incomeAdjustment)}</div>
              </div>
            )}
            <div>
              <span className="text-gray-500">給与所得</span>
              <div className="font-mono text-lg font-bold">{fmt(salaryIncome)}</div>
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-400">給与ページの入力データから自動計算（{salaryEntries.length}件）</p>
        </CardContent>
      </Card>

      {/* 不動産所得 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">不動産所得</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-w-xs">
            <Label>不動産所得（収入-経費の計算済み額）</Label>
            <Input
              inputMode="numeric"
              value={realEstateProfit}
              onChange={(e) => setRealEstateProfit(e.target.value)}
              placeholder="0"
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* 所得控除 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">所得控除</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <div>
              <Label>社会保険料控除</Label>
              <Input
                inputMode="numeric"
                value={socialInsurance}
                onChange={(e) => setSocialInsurance(e.target.value)}
                placeholder="0"
                className="mt-1"
              />
            </div>
            <div>
              <Label>生命保険料控除</Label>
              <Input
                inputMode="numeric"
                value={lifeInsurance}
                onChange={(e) => setLifeInsurance(e.target.value)}
                placeholder="0"
                className="mt-1"
              />
            </div>
            <div>
              <Label>地震保険料控除</Label>
              <Input
                inputMode="numeric"
                value={earthquakeInsurance}
                onChange={(e) => setEarthquakeInsurance(e.target.value)}
                placeholder="0"
                className="mt-1"
              />
            </div>
            <div>
              <Label>医療費控除</Label>
              <Input
                inputMode="numeric"
                value={medicalExpense}
                onChange={(e) => setMedicalExpense(e.target.value)}
                placeholder="0"
                className="mt-1"
              />
            </div>
            <div>
              <Label>小規模企業共済等（iDeCo）</Label>
              <Input
                inputMode="numeric"
                value={ideco}
                onChange={(e) => setIdeco(e.target.value)}
                placeholder="0"
                className="mt-1"
              />
            </div>
            <div>
              <Label>基礎控除</Label>
              <div className="mt-1 rounded border bg-gray-50 px-3 py-2 font-mono text-sm">
                {fmt(basicDeduction)}
              </div>
            </div>
          </div>
          <div className="mt-3 text-right text-sm">
            所得控除合計: <span className="font-mono font-bold">{fmt(totalDeductions)}</span>
          </div>
        </CardContent>
      </Card>

      {/* 税額控除 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">税額控除</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-w-xs">
            <Label>住宅ローン控除</Label>
            <Input
              inputMode="numeric"
              value={housingLoan}
              onChange={(e) => setHousingLoan(e.target.value)}
              placeholder="0"
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* 結果 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">計算結果</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between border-b pb-2">
              <span>総所得金額</span>
              <span className="font-mono">{fmt(totalIncome)}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span>所得控除合計</span>
              <span className="font-mono">-{fmt(totalDeductions)}</span>
            </div>
            <div className="flex justify-between border-b pb-2 font-bold">
              <span>課税所得</span>
              <span className="font-mono">{fmt(taxableIncome)}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span>所得税額（税率表）</span>
              <span className="font-mono">{fmt(incomeTax)}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span>源泉徴収済み</span>
              <span className="font-mono">-{fmt(withheldTax)}</span>
            </div>
            <div className="flex justify-between border-b pb-2 text-lg font-bold">
              <span>差引納税額（概算）</span>
              <span className={`font-mono ${incomeTax - withheldTax > 0 ? "text-red-600" : "text-green-600"}`}>
                {fmt(incomeTax - withheldTax)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ふるさと納税 */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="text-base text-blue-700">ふるさと納税 上限額（目安）</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-700 font-mono">{fmt(furusatoLimit)}円</div>
            <p className="mt-1 text-xs text-blue-500">自己負担2,000円で寄附できる上限額の目安です</p>
            <p className="mt-1 text-xs text-gray-400">※概算値です。正確な金額は税理士にご確認ください</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
