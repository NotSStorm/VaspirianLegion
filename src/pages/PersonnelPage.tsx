import { useEffect, useMemo, useState } from 'react';
import PersonnelTable from '../components/shared/PersonnelTable';
import { supabase } from '../lib/supabase';

const GROUP_ID = '5531725';

type PersonnelRow = {
  combinedName: string;
  unit: string;
  groupRank: string;
  tags: string[];
};

type RosterRecord = {
  profile_id: string;
  rank: string;
  company?: string | null;
  profile?: {
    roblox_username?: string | null;
    roblox_id?: string | null;
    discord_username?: string | null;
  } | null;
};

export default function PersonnelPage() {
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<PersonnelRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPersonnel = async () => {
      setLoading(true);

      try {
        const { data: rosterData, error: rosterError } = await supabase
          .from('roster')
          .select('profile_id, rank, company, profile:profiles!roster_profile_id_fkey(roblox_username, roblox_id, discord_username)')
          .order('created_at', { ascending: true });

        if (rosterError) {
          throw rosterError;
        }

        const profileIds = (rosterData || []).map((entry: any) => entry.profile_id);
        const { data: qualificationData } = await supabase
          .from('roster_qualifications')
          .select('profile_id, tag')
          .in('profile_id', profileIds.length ? profileIds : ['00000000-0000-0000-0000-000000000000']);

        const qualificationsByProfile = new Map<string, string[]>();
        (qualificationData || []).forEach((qualification: any) => {
          const existing = qualificationsByProfile.get(qualification.profile_id) || [];
          qualificationsByProfile.set(qualification.profile_id, [...existing, String(qualification.tag)]);
        });

        const roleCache = new Map<string, string>();
        const resolveGroupRank = async (robloxId?: string | null, fallbackRank = 'Unknown') => {
          if (!robloxId) return fallbackRank;
          if (roleCache.has(robloxId)) return roleCache.get(robloxId) as string;

          try {
            const response = await fetch(`https://groups.roblox.com/v1/users/${encodeURIComponent(robloxId)}/groups/roles`);
            if (!response.ok) {
              roleCache.set(robloxId, fallbackRank);
              return fallbackRank;
            }

            const payload = await response.json().catch(() => ({}));
            const groupRole = Array.isArray(payload?.data)
              ? payload.data.find((entry: any) => String(entry?.group?.id) === GROUP_ID)
              : null;
            const resolved = groupRole?.role?.name ? String(groupRole.role.name) : fallbackRank;
            roleCache.set(robloxId, resolved);
            return resolved;
          } catch {
            roleCache.set(robloxId, fallbackRank);
            return fallbackRank;
          }
        };

        const resolvedRows = await Promise.all(
          ((rosterData || []) as RosterRecord[]).map(async (entry) => {
            const robloxName = entry.profile?.roblox_username || entry.profile?.discord_username || 'Unknown';
            const groupRank = await resolveGroupRank(entry.profile?.roblox_id, entry.rank || 'Unranked');

            return {
              combinedName: `${groupRank} - ${robloxName}`,
              unit: entry.company || 'Unassigned',
              groupRank,
              tags: qualificationsByProfile.get(entry.profile_id) || []
            };
          })
        );

        setRows(resolvedRows);
      } catch (error) {
        console.error('Personnel roster load failed', error);
        setRows([]);
      } finally {
        setLoading(false);
      }
    };

    void loadPersonnel();
  }, []);

  const visibleRows = useMemo(
    () => rows.filter((row) => [row.combinedName, row.unit, row.groupRank].join(' ').toLowerCase().includes(query.toLowerCase())),
    [query, rows]
  );

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
        {loading ? <p className="text-sm text-slate-400">Loading accepted personnel...</p> : <PersonnelTable rows={visibleRows} />}
      </div>
    </section>
  );
}
