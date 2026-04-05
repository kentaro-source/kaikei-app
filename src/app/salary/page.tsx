"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const EMPLOYERS = [
  "株式会社DRK企画",
  "同仁病院",
  "森のクリニック",
  "若草病院",
  "小林保養院",
];

interface SalaryEntry {
  employer: string;
  date: string;
  taxable_salary: number;
  income_tax: number;
}

export default function SalaryPage() {
  const [employer, setEmployer] = useState(EMPLOYERS[0]);
  const [date, setDate] = useState("");
  const [taxable, setTaxable] = useState("");
  const [tax, setTax] = useState("");
  const [entries, setEntries] = useState<SalaryEntry[]>([]);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const taxableNum = parseInt(taxable.replace(/,/g, "") || "0");
  const taxNum = parseInt(tax.replace(/,/g, "") || "0");

  const handleAdd = () => {
    if (!date || !taxable) {
      setError("支給日と課税支給額を入力してください");
      return;
    }
    setError(null);
    setEntries((prev) => [
      ...prev,
      {
        employer,
        date,
        taxable_salary: taxableNum,
        income_tax: taxNum,
      },
    ]);
    setTaxable("");
    setTax("");
  };

  const handleRemove = (index: number) => {
    setEntries((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    const journals = entries.map((e) => ({
      id: crypto.randomUUID(),
      date: e.date,
      debit_account: "給与所得",
      debit_sub_account: e.employer,
      credit_account: "",
      credit_sub_account: "",
      amount: e.taxable_salary,
      description: `給与 ${e.employer} 課税支給額`,
    }));

    try {
      const res = await fetch("/api/wealthpark/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ journals }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    }
  };

  const totalTaxable = entries.reduce((sum, e) => sum + e.taxable_salary, 0);
  const totalTax = entries.reduce((sum, e) => sum + e.income_tax, 0);

  // 勤務先ごとの小計
  const byEmployer = EMPLOYERS.map((emp) => {
    const filtered = entries.filter((e) => e.employer === emp);
    return {
      employer: emp,
      count: filtered.length,
      taxable: filtered.reduce((s, e) => s + e.taxable_salary, 0),
      tax: filtered.reduce((s, e) => s + e.income_tax, 0),
    };
  }).filter((e) => e.count > 0);

  // 月別小計
  const byMonth = entries.reduce<Record<string, { taxable: number; tax: number }>>((acc, e) => {
    const month = e.date.substring(0, 7);
    if (!acc[month]) acc[month] = { taxable: 0, tax: 0 };
    acc[month].taxable += e.taxable_salary;
    acc[month].tax += e.income_tax;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">給与入力</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">給与明細を入力</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>勤務先</Label>
              <select
                value={employer}
                onChange={(e) => setEmployer(e.target.value)}
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
              >
                {EMPLOYERS.map((e) => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>支給日</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>課税支給額</Label>
              <Input
                inputMode="numeric"
                value={taxable}
                onChange={(e) => setTaxable(e.target.value)}
                placeholder="245000"
                className="mt-1"
              />
            </div>
            <div>
              <Label>源泉徴収税額</Label>
              <Input
                inputMode="numeric"
                value={tax}
                onChange={(e) => setTax(e.target.value)}
                placeholder="34600"
                className="mt-1"
              />
            </div>
          </div>
          <Button onClick={handleAdd} size="sm">追加</Button>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </CardContent>
      </Card>

      {entries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span>入力済み ({entries.length}件)</span>
              {!saved ? (
                <Button onClick={handleSave} size="sm">保存してCSV出力可能にする</Button>
              ) : (
                <span className="text-sm text-green-600">保存済み</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-gray-500">
                  <th className="pb-2">勤務先</th>
                  <th className="pb-2">支給日</th>
                  <th className="pb-2 text-right">課税支給額</th>
                  <th className="pb-2 text-right">源泉徴収税額</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => (
                  <tr key={i} className="border-b">
                    <td className="py-2">{e.employer}</td>
                    <td className="py-2">{e.date}</td>
                    <td className="py-2 text-right font-mono">{e.taxable_salary.toLocaleString()}</td>
                    <td className="py-2 text-right font-mono">{e.income_tax.toLocaleString()}</td>
                    <td className="py-2">
                      <button onClick={() => handleRemove(i)} className="text-xs text-red-400 hover:text-red-600">削除</button>
                    </td>
                  </tr>
                ))}
                <tr className="font-bold">
                  <td className="pt-2">合計</td>
                  <td></td>
                  <td className="pt-2 text-right font-mono">{totalTaxable.toLocaleString()}</td>
                  <td className="pt-2 text-right font-mono">{totalTax.toLocaleString()}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* 勤務先ごとの小計 */}
      {byEmployer.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">勤務先別 小計</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-gray-500">
                  <th className="pb-2">勤務先</th>
                  <th className="pb-2 text-right">件数</th>
                  <th className="pb-2 text-right">課税支給額</th>
                  <th className="pb-2 text-right">源泉徴収税額</th>
                </tr>
              </thead>
              <tbody>
                {byEmployer.map((e) => (
                  <tr key={e.employer} className="border-b">
                    <td className="py-2">{e.employer}</td>
                    <td className="py-2 text-right">{e.count}</td>
                    <td className="py-2 text-right font-mono">{e.taxable.toLocaleString()}</td>
                    <td className="py-2 text-right font-mono">{e.tax.toLocaleString()}</td>
                  </tr>
                ))}
                <tr className="font-bold">
                  <td className="pt-2">合計</td>
                  <td className="pt-2 text-right">{entries.length}</td>
                  <td className="pt-2 text-right font-mono">{totalTaxable.toLocaleString()}</td>
                  <td className="pt-2 text-right font-mono">{totalTax.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* 月別小計 */}
      {Object.keys(byMonth).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">月別 小計</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-gray-500">
                  <th className="pb-2">月</th>
                  <th className="pb-2 text-right">課税支給額</th>
                  <th className="pb-2 text-right">源泉徴収税額</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b)).map(([month, data]) => (
                  <tr key={month} className="border-b">
                    <td className="py-2">{month}</td>
                    <td className="py-2 text-right font-mono">{data.taxable.toLocaleString()}</td>
                    <td className="py-2 text-right font-mono">{data.tax.toLocaleString()}</td>
                  </tr>
                ))}
                <tr className="font-bold">
                  <td className="pt-2">合計</td>
                  <td className="pt-2 text-right font-mono">{totalTaxable.toLocaleString()}</td>
                  <td className="pt-2 text-right font-mono">{totalTax.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
