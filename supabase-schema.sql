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

create table if not exists user_profiles (
  user_id text primary key,
  email text not null default '',
  display_name text not null default '',
  photo_url text not null default '',
  role text not null default 'runner' check (role in ('runner', 'admin')),
  provider text not null default 'firebase',
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_profiles_email_idx on user_profiles (lower(email));
create index if not exists user_profiles_role_idx on user_profiles (role);

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

create table if not exists site_events (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default '',
  user_email text not null default '',
  user_name text not null default '',
  user_role text not null default 'runner',
  event_type text not null,
  event_title text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists site_events_created_at_idx on site_events (created_at desc);
create index if not exists site_events_user_id_idx on site_events (user_id);
create index if not exists site_events_event_type_idx on site_events (event_type);

create table if not exists support_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id text not null default '',
  username text not null default '',
  first_name text not null default '',
  last_name text not null default '',
  message text not null default '',
  status text not null default 'new' check (status in ('new', 'answered', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table support_messages
  add column if not exists answered_at timestamptz,
  add column if not exists answered_by_chat_id text not null default '';

create index if not exists support_messages_status_idx on support_messages (status);
create index if not exists support_messages_created_at_idx on support_messages (created_at desc);

create table if not exists telegram_admin_chats (
  chat_id text primary key,
  title text not null default '',
  username text not null default '',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace view marathon_bot_lookup as
select
  last_name as surname,
  concat(
    'номер ', bib_number,
    ', дистанция ', distance,
    ', статус ', case when status = 'active' then 'допущен' else 'дисквалифицирован' end
  ) as value
from participants;
