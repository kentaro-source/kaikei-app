"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import ImageUploader from "@/components/ImageUploader";

const DOCUMENT_TYPES = [
  { value: "salary_slip", label: "給与明細" },
];

export default function UploadPage() {
  const router = useRouter();
  const [documentType, setDocumentType] = useState("rent_statement");

  const handleUploadComplete = (document: Record<string, unknown>) => {
    window.location.href = `/documents/${document.id}`;
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">給与明細入力</h1>

      <div>
        <Label className="mb-2 block text-sm font-medium">
          給与明細をアップロード（画像・PDF）
        </Label>
        <ImageUploader
          documentType={documentType}
          onUploadComplete={handleUploadComplete}
        />
      </div>
    </div>
  );
}
