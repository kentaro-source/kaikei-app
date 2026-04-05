"use client";

import { useEffect, useState } from "react";

interface MonthData {
  month: string;
  count: number;
  total: number;
}

interface MonthProgressProps {
  source: "wealthpark" | "bankbook" | "card" | "all";
}

export default function MonthProgress({ source }: MonthProgressProps) {
  const [months, setMonths] = useState<MonthData[]>([]);
  const [period, setPeriod] = useState("");

  useEffect(() => {
    fetch(`/api/progress?source=${source}`)
      .then((r) => r.json())
      .then((data) => {
        setMonths(data.months || []);
        setPeriod(data.period || "");
      })
      .catch(() => {});
  }, [source]);

  if (months.length === 0) return null;

  return (
    <div className="rounded border bg-gray-50 px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs text-gray-500">{period}</span>
        <span className="text-xs text-gray-400">
          {months.filter((m) => m.count > 0).length}/12ヶ月
        </span>
      </div>
      <div className="flex gap-1">
        {months.map((m) => {
          const label = m.month.split("/")[1] + "月";
          return (
            <div
              key={m.month}
              className={`flex flex-1 flex-col items-center rounded px-1 py-1 text-xs ${
                m.count > 0
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-200 text-gray-400"
              }`}
              title={m.count > 0 ? `${m.count}件 / ${m.total.toLocaleString()}円` : "未取込"}
            >
              <span>{label}</span>
              <span className="text-[10px]">{m.count > 0 ? `${m.count}件` : "-"}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
