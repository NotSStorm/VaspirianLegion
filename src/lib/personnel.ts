import { supabase } from './supabase';

export function normalizePersonnelName(value?: string | null) {
  return String(value || '').trim().replace(/[_\s]+/g, '').toLowerCase();
}

export async function fetchExcludedPersonnelNames() {
  const { data, error } = await supabase
    .from('personnel_exclusions')
    .select('normalized_name');

  if (error) {
    if (/does not exist|relation/i.test(error.message)) {
      return new Set<string>();
    }

    throw error;
  }

  const excludedNames = new Set<string>();
  (data || []).forEach((row: any) => {
    const normalizedName = normalizePersonnelName(row.normalized_name);
    if (normalizedName) {
      excludedNames.add(normalizedName);
    }
  });

  return excludedNames;
}

export async function syncBattleLogUnitsForAliases(aliases: Array<string | null | undefined>, unit: string) {
  const normalizedAliases = new Set(
    aliases
      .map((value) => normalizePersonnelName(value))
      .filter(Boolean)
  );

  if (normalizedAliases.size === 0) {
    return 0;
  }

  const { data, error } = await supabase
    .from('battle_stat_logs')
    .select('participant_name');

  if (error) {
    throw error;
  }

  const matchingNames = new Set<string>();
  (data || []).forEach((row: any) => {
    const participantName = String(row.participant_name || '').trim();
    if (!participantName) {
      return;
    }

    const normalized = normalizePersonnelName(participantName);
    if (normalizedAliases.has(normalized)) {
      matchingNames.add(participantName);
    }
  });

  if (matchingNames.size === 0) {
    return 0;
  }

  const nextUnit = String(unit || '').trim() || 'Unassigned';
  const nowIso = new Date().toISOString();

  for (const participantName of matchingNames) {
    const { error: updateError } = await supabase
      .from('battle_stat_logs')
      .update({
        unit: nextUnit,
        updated_at: nowIso
      })
      .eq('participant_name', participantName);

    if (updateError) {
      throw updateError;
    }
  }

  return matchingNames.size;
}