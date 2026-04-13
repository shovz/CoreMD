interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
}

export default function StatCard({ label, value, sub }: StatCardProps) {
  return (
    <div
      style={{
        border: "1px solid #d1d5db",
        borderRadius: 8,
        padding: "20px 24px",
        background: "#fff",
      }}
    >
      <div style={{ fontSize: 32, fontWeight: 700, color: "#111827" }}>
        {value}
      </div>
      <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>{label}</div>
      {sub && (
        <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{sub}</div>
      )}
    </div>
  );
}
