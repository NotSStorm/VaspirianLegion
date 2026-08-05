import AssignmentSelect from './AssignmentSelect';
import { getMedalEmojiPath } from '../../lib/medals';

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
                <div className="flex justify-end">
                  {row.medals.length === 0 ? (
                    <span className="text-slate-500">None</span>
                  ) : (
                    <div className="flex items-center">
                      {row.medals.slice(0, 5).map((medal, medalIndex) => {
                        const emojiPath = getMedalEmojiPath(medal);

                        return (
                          <span
                            key={`${rowKey}:${medal}:${medalIndex}`}
                            className={`group/medal relative inline-flex h-8 w-8 items-center justify-center rounded-full border border-slateBlue/70 bg-[#0d121b] shadow-sm ${medalIndex === 0 ? '' : '-ml-2'}`}
                            title={medal}
                          >
                            {emojiPath ? (
                              <img src={emojiPath} alt={medal} className="h-7 w-7 rounded-full object-cover" />
                            ) : (
                              <span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-300">
                                {medal.slice(0, 2)}
                              </span>
                            )}
                            <span className="pointer-events-none absolute -top-9 left-1/2 z-20 hidden -translate-x-1/2 whitespace-nowrap rounded border border-slateBlue/70 bg-[#0d121b] px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-200 group-hover/medal:block">
                              {medal}
                            </span>
                          </span>
                        );
                      })}
                      {row.medals.length > 5 && (
                        <span className="ml-2 inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-silver/40 bg-[#0d121b] px-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">
                          +{row.medals.length - 5}
                        </span>
                      )}
                    </div>
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
