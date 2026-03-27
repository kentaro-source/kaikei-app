"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Document {
  id: string;
  type: string;
  file_name: string;
  uploaded_at: string;
  status: string;
  memo: string | null;
}

const TYPE_LABELS: Record<string, string> = {
  rent_statement: "家賃精算書",
  salary_slip: "給与明細",
  receipt: "経費レシート",
  other: "その他",
};

const STATUS_LABELS: Record<string, string> = {
  uploaded: "未処理",
  ocr_done: "OCR済",
  confirmed: "確認済",
  exported: "出力済",
};

const STATUS_COLORS: Record<string, string> = {
  uploaded: "bg-yellow-100 text-yellow-800",
  ocr_done: "bg-blue-100 text-blue-800",
  confirmed: "bg-green-100 text-green-800",
  exported: "bg-gray-100 text-gray-800",
};

export default function Dashboard() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/documents")
      .then((res) => res.json())
      .then((data) => setDocuments(data.documents || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const pendingCount = documents.filter((d) => d.status === "uploaded").length;
  const ocrDoneCount = documents.filter((d) => d.status === "ocr_done").length;
  const confirmedCount = documents.filter((d) => d.status === "confirmed").length;
  const exportedCount = documents.filter((d) => d.status === "exported").length;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">ダッシュボード</h1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-3xl font-bold text-yellow-600">{pendingCount}</div>
            <div className="text-sm text-gray-500">未処理</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-3xl font-bold text-blue-600">{ocrDoneCount}</div>
            <div className="text-sm text-gray-500">OCR済</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-3xl font-bold text-green-600">{confirmedCount}</div>
            <div className="text-sm text-gray-500">確認済</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-3xl font-bold text-gray-600">{exportedCount}</div>
            <div className="text-sm text-gray-500">出力済</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-3">
        <Link href="/upload">
          <Button>書類をアップロード</Button>
        </Link>
        <Link href="/export">
          <Button variant="outline">CSV出力</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>最近の書類</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-gray-500">読み込み中...</p>
          ) : documents.length === 0 ? (
            <p className="text-sm text-gray-500">
              書類がありません。
              <Link href="/upload" className="text-blue-600 hover:underline">
                アップロード
              </Link>
              してください。
            </p>
          ) : (
            <div className="space-y-2">
              {documents.slice(0, 20).map((doc) => (
                <Link
                  key={doc.id}
                  href={`/documents/${doc.id}`}
                  className="flex items-center justify-between rounded border p-3 hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{TYPE_LABELS[doc.type] || doc.type}</Badge>
                    <span className="text-sm">{doc.file_name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`rounded px-2 py-0.5 text-xs ${STATUS_COLORS[doc.status]}`}>
                      {STATUS_LABELS[doc.status] || doc.status}
                    </span>
                    <span className="text-xs text-gray-400">{doc.uploaded_at}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
