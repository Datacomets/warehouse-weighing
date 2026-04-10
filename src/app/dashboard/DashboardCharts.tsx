"use client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  ReferenceLine,
  CartesianGrid,
} from "recharts";
import { leadTimeMinutes } from "@/lib/stats";

interface Doc {
  id: string;
  wh_number: string;
  status: string;
  created_at: string;
  started_at: string;
  closed_at: string | null;
  gross_weight: number;
  actual_count: number;
}

export function DashboardCharts({
  bySupplier,
  docs,
  kpi,
}: {
  bySupplier: Record<string, number>;
  docs: Doc[];
  kpi: number;
}) {
  const supplierData = Object.entries(bySupplier)
    .map(([name, weight]) => ({ name: name.length > 14 ? name.slice(0, 14) + "…" : name, weight }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 8);

  // group by day for lead time
  const byDay: Record<string, number[]> = {};
  docs.forEach((d) => {
    if (d.status === "completed" && d.closed_at) {
      const day = d.created_at.slice(0, 10);
      const lt = leadTimeMinutes(d.started_at, d.closed_at);
      (byDay[day] = byDay[day] || []).push(lt);
    }
  });
  const dailyData = Object.entries(byDay)
    .sort()
    .slice(-14)
    .map(([day, arr]) => ({
      day: day.slice(5),
      avg: Math.round(arr.reduce((a, b) => a + b, 0) / arr.length),
    }));

  return (
    <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="card">
        <span className="section-title">น้ำหนักรวม / ชื่อสินค้าฝั่ง Supplier (kg)</span>
        <div className="h-64 mt-2">
          <ResponsiveContainer>
            <BarChart data={supplierData} layout="vertical" margin={{ left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={100} />
              <Tooltip />
              <Bar dataKey="weight" fill="#000080" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <span className="section-title">Lead Time เฉลี่ยรายวัน (นาที)</span>
        <div className="h-64 mt-2">
          <ResponsiveContainer>
            <LineChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="day" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <ReferenceLine y={kpi} stroke="#ba1a1a" strokeDasharray="4 4" label={{ value: "KPI", fontSize: 10 }} />
              <Line type="monotone" dataKey="avg" stroke="#000080" strokeWidth={2} dot />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
