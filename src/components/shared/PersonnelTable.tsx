interface PersonnelRow {
  combinedName: string;
  unit: string;
  groupRank: string;
  medals: string[];
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
            <th className="px-4 py-3">Rank / Roblox Name</th>
            <th className="px-4 py-3">Unit</th>
            <th className="px-4 py-3">Group Rank</th>
            <th className="px-4 py-3">Medals</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.combinedName} className="border-t border-slateBlue/40">
              <td className="px-4 py-3 font-semibold text-silver">{row.combinedName}</td>
              <td className="px-4 py-3">{row.unit}</td>
              <td className="px-4 py-3">{row.groupRank}</td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-2">
                  {row.medals.length === 0 ? (
                    <span className="text-slate-500">None</span>
                  ) : row.medals.slice(0, 3).map((medal) => (
                    <span key={medal} className="rounded border border-slateBlue/60 px-2 py-1 text-[10px] uppercase tracking-[0.25em] text-slate-300">{medal}</span>
                  ))}
                  {row.medals.length > 3 && (
                    <span className="rounded border border-silver/30 px-2 py-1 text-[10px] uppercase tracking-[0.25em] text-slate-400">+{row.medals.length - 3} more</span>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
