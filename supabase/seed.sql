insert into profiles (discord_id, discord_username, role, callsign, rank, company) values
  ('discord-1', 'Jolyne Valeryon', 'admin', 'S-Lt. Jolyne', 'Commanding Officer', 'Battery HQ'),
  ('discord-2', 'Lurac_Case', 'officer', 'S-Lt. Lurac', 'Executive Officer', 'Battery HQ'),
  ('discord-3', 'Wūlrīc Valeryon', 'officer', 'Ens. Wūlrīc', 'Commander', '82nd Pirkland'),
  ('discord-4', 'weaponizedbrick', 'member', 'SSgt. weaponizedbrick', 'Executive', '82nd Pirkland'),
  ('discord-5', 'Askel Amar Aït-Zenata', 'officer', 'SgtM. Askel', 'Gun Team I', '87th Melrose')
on conflict do nothing;

insert into roster_qualifications (profile_id, tag)
select id, tag from profiles p join (values
  ('discord-1','CO'),
  ('discord-2','XO'),
  ('discord-3','82nd'),
  ('discord-4','NCO'),
  ('discord-5','87th')
) as v(discord_id, tag) on p.discord_id = v.discord_id;

insert into battles (name, status, classification, theater, commanding_officer, personnel_count, threat_level, start_date, description, is_upcoming, is_public) values
  ('Operation Iron Meridian', 'Victory', 'Public', 'Pirkland Front', 'S-Lt. Jolyne Valeryon', 42, 4, '14 Mar 1808', 'A decisive artillery action across open ground.', false, true),
  ('Siege of North Bastion', 'Ongoing', 'Restricted', 'Melrose Ridge', 'SgtM. Askel Amar Aït-Zenata', 26, 5, 'Pending', 'Current siege underway.', false, false),
  ('Harbor Counterfire', 'Pending', 'Public', 'Anders Basin', 'Ens. Wūlrīc Valeryon', 18, 3, '04 Jul 1812', 'Upcoming counter-battery action.', true, true);

insert into medals (recipient_profile_id, medal_name, citation, campaign_tag, date_awarded, status_tags)
select id, 'Iron Laurel', 'For sustained artillery direction during the Iron Meridian campaign.', 'Iron Meridian', '14 Mar 1808', ARRAY['Declassified'] from profiles where discord_id = 'discord-5';

insert into lore_timeline (year_label, title, description, sort_order) values
  ('1798', 'The Founding Ledger', 'Pirkland and Melrose are consolidated into a unified artillery command.', 1),
  ('1803', 'The First Battery', 'The first unified gun crews and sappers begin field exercises.', 2),
  ('1811', 'Campaigns of the Iron March', 'The unit earns distinction in long-range bombardment and rapid engineering action.', 3);

insert into command_slots (tier, company, slot_title, profile_id, sort_order)
select 'Tier 1', 'Battery HQ', 'Commanding Officer', id, 1 from profiles where discord_id = 'discord-1';

insert into command_slots (tier, company, slot_title, profile_id, sort_order)
select 'Tier 1', 'Battery HQ', 'Executive Officer', id, 2 from profiles where discord_id = 'discord-2';

insert into site_settings (key, value) values
  ('wip_banner_enabled','true'),
  ('spreadsheet_url','https://example.com/roster'),
  ('discord_invite_url','https://discord.gg/example');
