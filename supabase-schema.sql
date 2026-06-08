create extension if not exists "pgcrypto";

create table if not exists participants (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  first_name text not null default '',
  last_name text not null default '',
  email text not null default '',
  phone text not null default '',
  gender text not null default '',
  birth_date date,
  distance text not null default '',
  country text not null default '',
  city text not null default '',
  photo text not null default '',
  registration_date timestamptz not null default now(),
  bmi numeric(5, 1) not null default 0,
  bmi_category text not null default '',
  height numeric(5, 1) not null default 0,
  weight numeric(5, 1) not null default 0,
  status text not null default 'active' check (status in ('active', 'disqualified')),
  disqualification_reason text not null default '',
  admin_note text not null default '',
  bib_number text not null unique,
  check_in_status text not null default 'pending' check (check_in_status in ('pending', 'checked-in')),
  runner_checklist jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists participants_user_id_idx on participants (user_id);
create index if not exists participants_last_name_idx on participants (lower(last_name));
create index if not exists participants_distance_idx on participants (distance);
create index if not exists participants_status_idx on participants (status);

create table if not exists admin_tasks (
  id text primary key,
  completed boolean not null default false,
  updated_by text not null default '',
  updated_at timestamptz not null default now()
);

insert into admin_tasks (id, completed)
values
  ('route', false),
  ('medical', false),
  ('volunteers', false),
  ('water', false)
on conflict (id) do nothing;

create or replace view marathon_bot_lookup as
select
  last_name as surname,
  concat(
    'номер ', bib_number,
    ', дистанция ', distance,
    ', статус ', case when status = 'active' then 'допущен' else 'дисквалифицирован' end
  ) as value
from participants;
