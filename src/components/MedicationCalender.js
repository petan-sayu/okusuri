import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";

// 服薬回数の棒グラフ
export const MedicationBarChart = ({ data }) => {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm">
      <h3 className="text-lg font-medium mb-4">過去7日間の服薬回数</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip
            labelStyle={{ color: "#374151" }}
            contentStyle={{
              backgroundColor: "#f9fafb",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
            }}
          />
          <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// 気分推移の折れ線グラフ
export const MoodLineChart = ({ data }) => {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm">
      <h3 className="text-lg font-medium mb-4">気分の推移</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
          <YAxis domain={[1, 10]} tick={{ fontSize: 12 }} />
          <Tooltip
            labelStyle={{ color: "#374151" }}
            contentStyle={{
              backgroundColor: "#f9fafb",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
            }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="mood"
            stroke="#10b981"
            strokeWidth={2}
            dot={{ r: 4 }}
            name="気分スコア"
          />
          <Line
            type="monotone"
            dataKey="anxiety"
            stroke="#f59e0b"
            strokeWidth={2}
            dot={{ r: 4 }}
            name="不安レベル"
          />
          <Line
            type="monotone"
            dataKey="energy"
            stroke="#8b5cf6"
            strokeWidth={2}
            dot={{ r: 4 }}
            name="エネルギー"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

// 薬剤分類の円グラフ
export const MedicationPieChart = ({ medications }) => {
  const data = [
    {
      name: "抗うつ剤",
      value: medications.filter((m) => m.isAntidepressant).length,
      color: "#10b981",
    },
    {
      name: "抗精神病薬",
      value: medications.filter((m) => m.isAntipsychotic).length,
      color: "#8b5cf6",
    },
    {
      name: "ヤーズフレックス",
      value: medications.filter((m) => m.isYazFlex).length,
      color: "#f59e0b",
    },
    {
      name: "その他",
      value: medications.filter(
        (m) => !m.isAntidepressant && !m.isAntipsychotic && !m.isYazFlex
      ).length,
      color: "#6b7280",
    },
  ].filter((item) => item.value > 0);

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm">
      <h3 className="text-lg font-medium mb-4">薬剤分類</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) =>
              `${name} ${(percent * 100).toFixed(0)}%`
            }
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

// メンタル状態の複合グラフ
export const MentalHealthChart = ({ data }) => {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm">
      <h3 className="text-lg font-medium mb-4">メンタルヘルス総合</h3>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis domain={[1, 10]} tick={{ fontSize: 12 }} />
          <Tooltip
            labelStyle={{ color: "#374151" }}
            contentStyle={{
              backgroundColor: "#f9fafb",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
            }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="mood"
            stroke="#10b981"
            strokeWidth={2}
            name="気分"
          />
          <Line
            type="monotone"
            dataKey="anxiety"
            stroke="#ef4444"
            strokeWidth={2}
            name="不安感"
          />
          <Line
            type="monotone"
            dataKey="sleep"
            stroke="#3b82f6"
            strokeWidth={2}
            name="睡眠の質"
          />
          <Line
            type="monotone"
            dataKey="appetite"
            stroke="#f59e0b"
            strokeWidth={2}
            name="食欲"
          />
          <Line
            type="monotone"
            dataKey="energy"
            stroke="#8b5cf6"
            strokeWidth={2}
            name="エネルギー"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
