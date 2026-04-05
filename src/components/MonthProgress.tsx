"use client";

import { useEffect, useState } from "react";

interface MonthData {
  month: string;
  count: number;
  total: number;
  first_date: string;
  last_date: string;
}

interface MonthProgressProps {
  source: "wealthpark" | "wealthpark_personal" | "bankbook" | "card" | "all";
  showDate?: boolean;
}

export default function MonthProgress({ source, showDate = true }: MonthProgressProps) {
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

  const doneCount = months.filter((m) => m.count > 0).length;

  return (
    <div className="rounded border bg-gray-50 px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs text-gray-500">{period}</span>
        <span className="text-xs text-gray-400">{doneCount}/12ヶ月</span>
      </div>
      <div className="flex gap-1">
        {months.map((m) => {
          const monthNum = m.month.split("/")[1];
          const shortDate = m.last_date ? m.last_date.substring(5) : "";
          return (
            <div
              key={m.month}
              className={`flex flex-1 flex-col items-center rounded px-0.5 py-1 ${
                m.count > 0
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-200 text-gray-400"
              }`}
              title={m.count > 0
                ? `${m.count}件 / ${m.total.toLocaleString()}円\n${m.first_date} 〜 ${m.last_date}`
                : "未取込"
              }
            >
              <span className="text-xs font-medium">{monthNum}月</span>
              {m.count > 0 ? (
                <>
                  <span className="text-[10px]">{m.count}件</span>
                  {showDate && shortDate && <span className="text-[9px] text-green-500">〜{shortDate}</span>}
                </>
              ) : (
                <span className="text-[10px]">-</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
