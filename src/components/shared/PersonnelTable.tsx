import AssignmentSelect from './AssignmentSelect';
import { formatMedalDisplayName, getMedalEmojiPath } from '../../lib/medals';
import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';

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
  const [openMedalMenuKey, setOpenMedalMenuKey] = useState<string | null>(null);
  const [medalMenuStyle, setMedalMenuStyle] = useState<{ top: number; left: number } | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  const openMedalMenu = (rowKey: string, anchorElement: HTMLElement) => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    const anchorRect = anchorElement.getBoundingClientRect();
    const popupWidth = 320;
    const viewportMargin = 12;
    const spaceBelow = window.innerHeight - anchorRect.bottom - viewportMargin;
    const spaceAbove = anchorRect.top - viewportMargin;
    const estimatedHeight = 220;
    const fitsBelow = spaceBelow >= estimatedHeight || spaceBelow >= spaceAbove;
    const top = fitsBelow
      ? Math.min(anchorRect.bottom + 8, window.innerHeight - viewportMargin)
      : Math.max(viewportMargin, anchorRect.top - estimatedHeight - 8);
    const left = Math.min(
      Math.max(viewportMargin, anchorRect.right - popupWidth),
      window.innerWidth - popupWidth - viewportMargin
    );

    setMedalMenuStyle({ top, left });
    setOpenMedalMenuKey(rowKey);
  };

  const scheduleCloseMedalMenu = (rowKey: string) => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
    }

    closeTimerRef.current = window.setTimeout(() => {
      setOpenMedalMenuKey((current) => (current === rowKey ? null : current));
      setMedalMenuStyle((current) => (current ? null : current));
      closeTimerRef.current = null;
    }, 180);
  };

  const keepMedalMenuOpen = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

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
                    <div className="relative flex items-center">
                      {row.medals.slice(0, 5).map((medal, medalIndex) => {
                        const emojiPath = getMedalEmojiPath(medal);
                        const displayMedal = formatMedalDisplayName(medal);

                        return (
                          <div
                            key={`${rowKey}:${medal}:${medalIndex}`}
                            className={`group/medal relative inline-flex h-8 w-8 items-center justify-center ${medalIndex === 0 ? '' : '-ml-1'}`}
                            title={displayMedal}
                          >
                            {emojiPath ? (
                              <img src={emojiPath} alt={displayMedal} className="h-7 w-7 object-contain" />
                            ) : (
                              <span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-300">
                                {medal.slice(0, 2)}
                              </span>
                            )}
                            <span className="pointer-events-none absolute -top-9 left-1/2 z-20 hidden -translate-x-1/2 whitespace-nowrap rounded border border-slateBlue/70 bg-[#0d121b] px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-200 group-hover/medal:block">
                              {displayMedal}
                            </span>
                          </div>
                        );
                      })}
                      {row.medals.length > 5 && (
                        <button
                          type="button"
                          onMouseEnter={(event) => openMedalMenu(rowKey, event.currentTarget)}
                          onMouseLeave={() => scheduleCloseMedalMenu(rowKey)}
                          className="ml-2 inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-silver/40 bg-[#0d121b] px-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300"
                          aria-expanded={openMedalMenuKey === rowKey}
                        >
                          +{row.medals.length - 5}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </td>
            </tr>
          );})}
        </tbody>
      </table>
      {openMedalMenuKey && medalMenuStyle && createPortal(
        <div
          className="fixed z-50 w-80 max-h-[80vh] overflow-hidden rounded border border-slateBlue/70 bg-[#0d121b] p-3 shadow-xl"
          style={{ top: `${medalMenuStyle.top}px`, left: `${medalMenuStyle.left}px` }}
          onMouseEnter={keepMedalMenuOpen}
          onMouseLeave={() => scheduleCloseMedalMenu(openMedalMenuKey)}
        >
          <div className="mb-2 text-[10px] uppercase tracking-[0.25em] text-slate-400">All Medals</div>
          <div data-testid="medal-menu-list" className="max-h-[70vh] overflow-y-auto pr-1">
            {rows
              .find((row) => (row.key || row.combinedName) === openMedalMenuKey)
              ?.medals.map((medal, medalIndex) => {
                const emojiPath = getMedalEmojiPath(medal);
                const displayMedal = formatMedalDisplayName(medal);
                return (
                  <div key={`dropdown:${openMedalMenuKey}:${medal}:${medalIndex}`} className="flex items-center gap-2 rounded px-2 py-1 hover:bg-slateBlue/20">
                    {emojiPath ? (
                      <img src={emojiPath} alt={displayMedal} className="h-6 w-6 object-contain" />
                    ) : (
                      <span className="inline-flex h-6 w-6 items-center justify-center text-[9px] font-semibold uppercase text-slate-300">
                        {medal.slice(0, 2)}
                      </span>
                    )}
                    <span className="text-xs text-slate-200">{displayMedal}</span>
                  </div>
                );
              })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
