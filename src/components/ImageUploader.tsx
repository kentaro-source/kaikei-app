"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface ImageUploaderProps {
  documentType: string;
  onUploadComplete: (document: Record<string, unknown>) => void;
}

export default function ImageUploader({ documentType, onUploadComplete }: ImageUploaderProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const selectedFileRef = useRef<File | null>(null);

  const [pdfName, setPdfName] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);

  const pdfToImage = useCallback(async (file: File): Promise<File> => {
    setConverting(true);
    try {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d")!;
      await page.render({ canvasContext: ctx, viewport }).promise;

      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), "image/png");
      });
      return new File([blob], file.name.replace(/\.pdf$/i, ".png"), { type: "image/png" });
    } finally {
      setConverting(false);
    }
  }, []);

  const handleFile = useCallback(async (file: File) => {
    const isImage = file.type.startsWith("image/");
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isImage && !isPdf) {
      setError("画像またはPDFファイルを選択してください");
      return;
    }
    setError(null);

    if (isPdf) {
      setPdfName(file.name);
      selectedFileRef.current = file; // フォールバック: PDFのまま保持
      try {
        const imageFile = await pdfToImage(file);
        selectedFileRef.current = imageFile;
        const reader = new FileReader();
        reader.onload = () => setPreview(reader.result as string);
        reader.readAsDataURL(imageFile);
      } catch {
        // 変換失敗でもPDFのままアップロード可能
        setPreview("pdf");
      }
    } else {
      setPdfName(null);
      selectedFileRef.current = file;
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  }, [pdfToImage]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleUpload = async () => {
    const file = selectedFileRef.current || fileInputRef.current?.files?.[0] || cameraInputRef.current?.files?.[0];
    if (!file) {
      setError("ファイルを選択してください");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", documentType);

      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      onUploadComplete(data.document);
      setPreview(null);
      setPdfName(null);
      selectedFileRef.current = null;
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "アップロードに失敗しました");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        {/* ドラッグ&ドロップエリア */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-10 transition-colors ${
            dragging
              ? "border-blue-500 bg-blue-50"
              : "border-gray-300 hover:border-gray-400 hover:bg-gray-50"
          }`}
        >
          <svg className="mb-3 h-10 w-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 16V4m0 0l-4 4m4-4l4 4M4 14v4a2 2 0 002 2h12a2 2 0 002-2v-4" />
          </svg>
          <p className="text-sm text-gray-600">
            画像・PDFをドラッグ&ドロップ
          </p>
          <p className="mt-1 text-xs text-gray-400">
            または クリックして選択
          </p>
        </div>

        {/* カメラ・ファイル選択ボタン（スマホ向け） */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => cameraInputRef.current?.click()}
            type="button"
          >
            カメラで撮影
          </Button>
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*,application/pdf"
            capture="environment"
            onChange={handleFileSelect}
            className="hidden"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {/* PDF変換中 */}
        {converting && (
          <p className="text-sm text-blue-500">PDFを画像に変換中...</p>
        )}

        {/* プレビュー（画像） */}
        {preview && preview !== "pdf" && (
          <div className="space-y-3">
            <img
              src={preview}
              alt="プレビュー"
              className="max-h-64 rounded border object-contain"
            />
            <Button onClick={handleUpload} disabled={uploading}>
              {uploading ? "アップロード中..." : "アップロード"}
            </Button>
          </div>
        )}

        {/* プレビュー（PDF） */}
        {preview === "pdf" && pdfName && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded border bg-gray-50 px-4 py-3">
              <span className="text-sm font-medium">{pdfName}</span>
            </div>
            <Button onClick={handleUpload} disabled={uploading}>
              {uploading ? "アップロード中..." : "アップロード"}
            </Button>
          </div>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}
      </CardContent>
    </Card>
  );
}
