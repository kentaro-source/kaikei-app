"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface OcrProcessorProps {
  documentId: string;
  documentType: string;
  imagePath: string;
  templateId?: string;
  onOcrComplete: (result: Record<string, unknown>) => void;
  autoStart?: boolean;
}

export default function OcrProcessor({
  documentId,
  documentType,
  imagePath,
  templateId,
  onOcrComplete,
  autoStart = false,
}: OcrProcessorProps) {
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isPdf = imagePath.toLowerCase().endsWith(".pdf");

  const runOcr = useCallback(async () => {
    setProcessing(true);
    setError(null);
    setProgress(0);

    try {
      let fullText = "";

      if (isPdf) {
        // PDFはサーバー側でテキスト抽出
        setStatus("PDFからテキストを抽出中...");
        setProgress(30);

        const pdfRes = await fetch("/api/pdf-text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file_path: imagePath }),
        });
        const pdfData = await pdfRes.json();
        if (!pdfRes.ok) throw new Error(pdfData.error);

        fullText = pdfData.text;
        setProgress(70);
      } else {
        // 画像はクライアント側でOCR
        setStatus("OCRエンジンを読み込み中...");
        setProgress(10);

        const { createWorker } = await import("tesseract.js");
        const worker = await createWorker("jpn", 1, {
          logger: (m: { status: string; progress: number }) => {
            setStatus(m.status);
            setProgress(Math.round(m.progress * 70) + 10);
          },
        });

        setStatus("画像を認識中...");
        const { data: { text } } = await worker.recognize(`/api/images/${imagePath}`);
        fullText = text;
        await worker.terminate();
      }

      setProgress(80);
      setStatus("結果を保存中...");

      const res = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document_id: documentId,
          raw_text: fullText,
          template_id: templateId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setProgress(100);
      setStatus("完了");
      onOcrComplete(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "OCR処理に失敗しました");
    } finally {
      setProcessing(false);
    }
  }, [documentId, imagePath, isPdf, templateId, onOcrComplete]);

  const autoStarted = useRef(false);
  useEffect(() => {
    if (autoStart && !autoStarted.current) {
      autoStarted.current = true;
      runOcr();
    }
  }, [autoStart, runOcr]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">OCR処理</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button onClick={runOcr} disabled={processing}>
          {processing ? "処理中..." : isPdf ? "PDFテキスト抽出" : "OCRを実行"}
        </Button>

        {processing && (
          <div className="space-y-2">
            <div className="h-2 w-full rounded-full bg-gray-200">
              <div
                className="h-2 rounded-full bg-blue-600 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-sm text-gray-500">{status}</p>
          </div>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}
      </CardContent>
    </Card>
  );
}
