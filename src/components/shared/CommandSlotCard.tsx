interface CommandSlotCardProps {
  title: string;
  assigned?: string;
  filled?: boolean;
}

export default function CommandSlotCard({ title, assigned, filled = false }: CommandSlotCardProps) {
  return (
    <div className={`rounded border p-4 ${filled ? 'border-silver/40 bg-slateBlue/20' : 'border-amber-500/40 bg-amber-500/10'}`}>
      <div className="text-[10px] uppercase tracking-[0.3em] text-slate-400">{title}</div>
      <div className="mt-2 text-sm font-semibold text-silver">{filled ? assigned : 'VACANT — OPEN FOR RECRUITMENT'}</div>
    </div>
  );
}
