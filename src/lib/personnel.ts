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