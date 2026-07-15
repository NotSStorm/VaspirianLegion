interface StatCardProps {
  label: string;
  value: string | number;
  accent?: 'default' | 'accent';
}

export default function StatCard({ label, value, accent = 'default' }: StatCardProps) {
  return (
    <div className={`rounded border p-4 ${accent === 'accent' ? 'border-silver/40 bg-slateBlue/30' : 'border-slateBlue/60 bg-[#141a24]'}`}>
      <div className="text-[10px] uppercase tracking-[0.3em] text-slate-400">{label}</div>
      <div className="mt-2 font-mono text-2xl font-semibold text-silver">{value}</div>
    </div>
  );
}
