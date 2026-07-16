interface BattleCardProps {
  name: string;
  classification: string;
  status: string;
  theater: string;
  commandingOfficer: string;
  personnelCount: number;
  date: string;
  threatLevel: number;
}

const statusStyles: Record<string, string> = {
  Victory: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  Defeat: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
  Ongoing: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  Pending: 'border-tan/40 bg-tan/10 text-tan'
};

export default function BattleCard({ name, classification, status, theater, commandingOfficer, personnelCount, date, threatLevel }: BattleCardProps) {
  return (
    <div className="rounded border border-slateBlue/60 bg-[#141a24] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-lg font-semibold text-silver">{name}</div>
        <div className="flex gap-2 text-xs uppercase tracking-[0.3em]">
          <span className="rounded border border-slateBlue/60 px-2 py-1 text-slate-300">{classification}</span>
          <span className={`rounded border px-2 py-1 ${statusStyles[status] ?? 'border-slateBlue/60 bg-slateBlue/20 text-slate-300'}`}>{status}</span>
        </div>
      </div>
      <div className="mt-4 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
        <div><span className="text-slate-400">Theater</span><div className="font-semibold text-silver">{theater}</div></div>
        <div><span className="text-slate-400">CO</span><div className="font-semibold text-silver">{commandingOfficer}</div></div>
        <div><span className="text-slate-400">Personnel</span><div className="font-semibold text-silver">{personnelCount}</div></div>
        <div><span className="text-slate-400">Date</span><div className="font-semibold text-silver">{date}</div></div>
      </div>
      <div className="mt-4">
        <div className="mb-2 text-[10px] uppercase tracking-[0.3em] text-slate-400">Performance</div>
        <div className="flex gap-1">
          {Array.from({ length: 5 }).map((_, index) => (
            <span key={index} className={`h-2.5 w-2.5 rounded-full ${index < threatLevel ? 'bg-silver' : 'bg-slateBlue/60'}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
