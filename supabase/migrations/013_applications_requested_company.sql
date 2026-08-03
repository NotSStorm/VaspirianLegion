alter table applications
  add column if not exists requested_company text;

alter table applications
  drop constraint if exists applications_requested_company_check;

alter table applications
  add constraint applications_requested_company_check
  check (requested_company is null or requested_company in ('82nd Pirkland', '87th Melrose'));
