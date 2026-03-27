"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

interface ImageUploaderProps {
  documentType: string;
  onUploadComplete: (document: Record<string, unknown>) => void;
}

export default function ImageUploader({ documentType, onUploadComplete }: ImageUploaderProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0] || cameraInputRef.current?.files?.[0];
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
        <div className="flex gap-2">
          <div>
            <Label htmlFor="camera-input" className="cursor-pointer">
              <Button
                variant="outline"
                onClick={() => cameraInputRef.current?.click()}
                type="button"
              >
                カメラで撮影
              </Button>
            </Label>
            <input
              ref={cameraInputRef}
              id="camera-input"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
          <div>
            <Label htmlFor="file-input" className="cursor-pointer">
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                type="button"
              >
                画像を選択
              </Button>
            </Label>
            <input
              ref={fileInputRef}
              id="file-input"
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        </div>

        {preview && (
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

        {error && <p className="text-sm text-red-500">{error}</p>}
      </CardContent>
    </Card>
  );
}
