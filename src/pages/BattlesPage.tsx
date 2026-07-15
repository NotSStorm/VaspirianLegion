import BattleCard from '../components/shared/BattleCard';

const battles = [
  { name: 'Operation Iron Meridian', classification: 'Public', status: 'Victory', theater: 'Pirkland Front', commandingOfficer: 'S-Lt. Jolyne Valeryon', personnelCount: 42, date: '14 Mar 1808', threatLevel: 4 },
  { name: 'Siege of North Bastion', classification: 'Restricted', status: 'Ongoing', theater: 'Melrose Ridge', commandingOfficer: 'SgtM. Askel Amar Aït-Zenata', personnelCount: 26, date: 'Pending', threatLevel: 5 },
  { name: 'Harbor Counterfire', classification: 'Public', status: 'Pending', theater: 'Anders Basin', commandingOfficer: 'Ens. Wūlrīc Valeryon', personnelCount: 18, date: '04 Jul 1812', threatLevel: 3 }
];

export default function BattlesPage() {
  return (
    <section className="space-y-6">
      <div className="rounded border border-slateBlue/70 bg-[#141a24] p-6">
        <div className="text-[10px] uppercase tracking-[0.35em] text-slate-400">Battles Ledger</div>
        <h2 className="mt-2 text-3xl font-semibold uppercase tracking-[0.2em] text-silver">Engagements</h2>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {battles.map((battle) => (
          <BattleCard key={battle.name} {...battle} />
        ))}
      </div>
    </section>
  );
}
