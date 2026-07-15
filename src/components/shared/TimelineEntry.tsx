interface TimelineEntryProps {
  year: string;
  title: string;
  description: string;
}

export default function TimelineEntry({ year, title, description }: TimelineEntryProps) {
  return (
    <div className="relative border-l border-slateBlue/60 pl-6 pb-6">
      <div className="absolute -left-[7px] top-0 h-3.5 w-3.5 rounded-full border border-silver/50 bg-slateBlue" />
      <div className="text-sm font-semibold uppercase tracking-[0.3em] text-silver">{year}</div>
      <div className="mt-1 text-lg font-semibold text-silver">{title}</div>
      <p className="mt-2 text-sm text-slate-300">{description}</p>
    </div>
  );
}
