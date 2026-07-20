import AssignmentSelect from './AssignmentSelect';

interface PersonnelRow {
  key?: string;
  username?: string;
  profileId?: string | null;
  combinedName: string;
  unit: string;
  groupRank: string;
  medals: string[];
}

interface PersonnelTableProps {
  rows: PersonnelRow[];
  editableUnits?: boolean;
  unitOptions?: Array<{ value: string; label: string; disabled?: boolean }>;
  updatingUnitKey?: string | null;
  onUnitChange?: (row: PersonnelRow, unit: string) => void;
}

export default function PersonnelTable({ rows, editableUnits = false, unitOptions = [], updatingUnitKey = null, onUnitChange }: PersonnelTableProps) {
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
          {rows.map((row) => {
            const rowKey = row.key || row.combinedName;
            const unitBusy = updatingUnitKey === rowKey;

            return (
            <tr key={rowKey} className="border-t border-slateBlue/40">
              <td className="px-4 py-3 font-semibold text-silver">{row.combinedName}</td>
              <td className="px-4 py-3">
                {editableUnits && onUnitChange && unitOptions.length > 0 ? (
                  <AssignmentSelect
                    value={row.unit || 'Unassigned'}
                    onChange={(nextUnit) => onUnitChange(row, nextUnit)}
                    disabled={unitBusy}
                    options={unitOptions}
                    className="w-full rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver"
                  />
                ) : (
                  row.unit
                )}
              </td>
              <td className="px-4 py-3">{row.groupRank || 'Not yet synced'}</td>
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
          );})}
        </tbody>
      </table>
    </div>
  );
}
