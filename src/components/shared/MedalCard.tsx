interface MedalCardProps {
  recipient: string;
  medalName: string;
  citation: string;
  campaignTag: string;
  date: string;
  status: string;
}

export default function MedalCard({ recipient, medalName, citation, campaignTag, date, status }: MedalCardProps) {
  return (
    <div className="rounded border border-slateBlue/60 bg-[#141a24] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-slate-400">{recipient}</div>
          <div className="mt-1 text-lg font-semibold text-silver">{medalName}</div>
        </div>
        <span className="rounded border border-slateBlue/60 px-2 py-1 text-xs uppercase tracking-[0.3em] text-slate-300">{status}</span>
      </div>
      <p className="mt-4 text-sm text-slate-300">{citation}</p>
      <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-400">
        <span>{campaignTag}</span>
        <span>{date}</span>
      </div>
    </div>
  );
}
