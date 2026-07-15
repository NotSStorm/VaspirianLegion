interface PersonnelRow {
  username: string;
  callsign: string;
  rank: string;
  tags: string[];
}

interface PersonnelTableProps {
  rows: PersonnelRow[];
}

export default function PersonnelTable({ rows }: PersonnelTableProps) {
  return (
    <div className="overflow-hidden rounded border border-slateBlue/60 bg-[#141a24]">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slateBlue/30 text-slate-200">
          <tr>
            <th className="px-4 py-3">Username</th>
            <th className="px-4 py-3">Callsign / Rank</th>
            <th className="px-4 py-3">Rank</th>
            <th className="px-4 py-3">Tags</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.username} className="border-t border-slateBlue/40">
              <td className="px-4 py-3 font-semibold text-silver">{row.username}</td>
              <td className="px-4 py-3">{row.callsign}</td>
              <td className="px-4 py-3">{row.rank}</td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-2">
                  {row.tags.map((tag) => (
                    <span key={tag} className="rounded border border-slateBlue/60 px-2 py-1 text-[10px] uppercase tracking-[0.25em] text-slate-300">{tag}</span>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
