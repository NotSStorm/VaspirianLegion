import MedalCard from '../components/shared/MedalCard';

const medals = [
  { recipient: 'SgtM. Askel Amar Aït-Zenata', medalName: 'Iron Laurel', citation: 'For sustained artillery direction during the Iron Meridian campaign.', campaignTag: 'Iron Meridian', date: '14 Mar 1808', status: 'Declassified' },
  { recipient: 'SSgt. Jorge Jørgensen', medalName: 'Silver Spur', citation: 'For engineering excellence and rapid deployment under fire.', campaignTag: 'North Bastion', date: '11 Apr 1809', status: 'Posthumous' }
];

export default function MedalsPage() {
  return (
    <section className="space-y-6">
      <div className="rounded border border-slateBlue/70 bg-[#141a24] p-6">
        <div className="text-[10px] uppercase tracking-[0.35em] text-slate-400">Medals & Commendations</div>
        <h2 className="mt-2 text-3xl font-semibold uppercase tracking-[0.2em] text-silver">Honors</h2>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {medals.map((medal) => (
          <MedalCard key={medal.medalName} {...medal} />
        ))}
      </div>
    </section>
  );
}
