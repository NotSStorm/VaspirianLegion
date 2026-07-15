import { useMemo, useState } from 'react';
import PersonnelTable from '../components/shared/PersonnelTable';

const rows = [
  { username: 'Jolyne Valeryon', callsign: 'S-Lt. Jolyne', rank: 'Commanding Officer', tags: ['CO', 'Battery'] },
  { username: 'Lurac_Case', callsign: 'S-Lt. Lurac', rank: 'Executive Officer', tags: ['XO', 'HQ'] },
  { username: 'Wūlrīc Valeryon', callsign: 'Ens. Wūlrīc', rank: 'Commander', tags: ['82nd'] },
  { username: 'weaponizedbrick', callsign: 'SSgt. weaponizedbrick', rank: 'Executive', tags: ['NCO'] },
  { username: 'Askel Amar Aït-Zenata', callsign: 'SgtM. Askel', rank: 'Gun Team I', tags: ['87th', 'Gunner'] }
];

export default function PersonnelPage() {
  const [query, setQuery] = useState('');
  const visibleRows = useMemo(() => rows.filter((row) => [row.username, row.callsign, row.rank].join(' ').toLowerCase().includes(query.toLowerCase())), [query]);

  return (
    <section className="space-y-6">
      <div className="rounded border border-slateBlue/70 bg-[#141a24] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.35em] text-slate-400">Personnel Ledger</div>
            <h2 className="mt-2 text-3xl font-semibold uppercase tracking-[0.2em] text-silver">Roster</h2>
          </div>
          <input value={query} onChange={(e) => setQuery(e.target.value)} className="rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver" placeholder="Search by username or rank" />
        </div>
      </div>

      <div className="rounded border border-slateBlue/70 bg-[#141a24] p-6">
        <div className="mb-4 text-[10px] uppercase tracking-[0.35em] text-slate-400">Command</div>
        <PersonnelTable rows={visibleRows} />
      </div>
    </section>
  );
}
