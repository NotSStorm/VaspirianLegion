export type Role = 'member' | 'officer' | 'admin';

export interface Profile {
  id: string;
  discord_id?: string;
  discord_username?: string;
  roblox_id?: string;
  roblox_username?: string;
  role: Role;
  callsign?: string;
  rank?: string;
  company?: string;
  roblox_verification_code?: string;
  roblox_verified_at?: string;
  created_at?: string;
}

export interface RosterQualification { profile_id: string; tag: string; }

export interface Battle {
  id: string;
  name: string;
  status: string;
  classification: string;
  theater: string;
  commanding_officer: string;
  personnel_count: number;
  threat_level: number;
  start_date: string;
  description: string;
  is_upcoming: boolean;
  is_public: boolean;
}

export interface Medal {
  id: string;
  recipient_profile_id: string;
  medal_name: string;
  citation: string;
  campaign_tag: string;
  date_awarded: string;
  status_tags: string[];
}

export interface LoreTimelineEntry {
  id: string;
  year_label: string;
  title: string;
  description: string;
  sort_order: number;
}

export interface CommandSlot {
  id: string;
  tier: string;
  company: string;
  slot_title: string;
  profile_id?: string | null;
  sort_order: number;
}

export interface SiteSetting {
  key: string;
  value: string;
}

export interface Application {
  id: string;
  profile_id: string;
  service_number: string;
  callsign: string;
  timezone: string;
  requested_group_join: boolean;
  status: string;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
}

export interface RosterEntry {
  id: string;
  profile_id: string;
  rank: string;
  callsign: string;
  company?: string | null;
  created_at: string;
}
