"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface JournalEntry {
  id: string;
  date: string;
  debit_account: string;
  credit_account: string;
  amount: number;
  description: string;
  exported: number;
}

export default function ExportPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from.replace(/-/g, "/"));
      if (to) params.set("to", to.replace(/-/g, "/"));
      params.set("unexported", "1");

      const res = await fetch(`/api/export?${params}`);
      const data = await res.json();
      setEntries(data.entries || []);
      setSelectedIds(new Set((data.entries || []).map((e: JournalEntry) => e.id)));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, []);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === entries.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(entries.map((e) => e.id)));
    }
  };

  const handleExport = async () => {
    if (selectedIds.size === 0) return;
    setExporting(true);
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entry_ids: Array.from(selectedIds) }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }

      // CSVダウンロード
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement("a");
      a.href = url;
      a.download = `yayoi_import_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      // リスト更新
      fetchEntries();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "エクスポートに失敗しました");
    } finally {
      setExporting(false);
    }
  };

  const totalAmount = entries
    .filter((e) => selectedIds.has(e.id))
    .reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">弥生CSV出力</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">期間選択</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="space-y-1">
              <Label>開始日</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>終了日</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button onClick={fetchEntries} variant="outline">
                絞り込み
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span>未出力の仕訳 ({entries.length}件)</span>
            <Button onClick={handleExport} disabled={exporting || selectedIds.size === 0}>
              {exporting ? "出力中..." : `CSVダウンロード (${selectedIds.size}件)`}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-gray-500">読み込み中...</p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-gray-500">未出力の仕訳がありません。</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === entries.length}
                        onChange={toggleAll}
                      />
                    </TableHead>
                    <TableHead>日付</TableHead>
                    <TableHead>借方</TableHead>
                    <TableHead>貸方</TableHead>
                    <TableHead className="text-right">金額</TableHead>
                    <TableHead>摘要</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(e.id)}
                          onChange={() => toggleSelect(e.id)}
                        />
                      </TableCell>
                      <TableCell>{e.date}</TableCell>
                      <TableCell>{e.debit_account}</TableCell>
                      <TableCell>{e.credit_account}</TableCell>
                      <TableCell className="text-right">
                        {e.amount.toLocaleString()}
                      </TableCell>
                      <TableCell>{e.description}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-3 text-right text-sm text-gray-500">
                選択合計: {totalAmount.toLocaleString()} 円
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
