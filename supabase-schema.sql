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

create table if not exists app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into app_settings (key, value)
values
  ('marathon_info', jsonb_build_object(
    'name', 'Marathon Skills',
    'year', 2026,
    'start_time', '09:00',
    'distances', jsonb_build_array('5 км', '10 км', '21 км', '42 км')
  ))
on conflict (key) do update
set value = excluded.value,
    updated_at = now();

create table if not exists bot_faq (
  id uuid primary key default gen_random_uuid(),
  intent text not null default '',
  question text not null default '',
  answer text not null default '',
  keywords text[] not null default array[]::text[],
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bot_faq_enabled_idx on bot_faq (enabled);
create index if not exists bot_faq_intent_idx on bot_faq (intent);

insert into bot_faq (intent, question, answer, keywords)
values
  ('distances', 'Какие дистанции есть на марафоне?', 'Доступны дистанции 5 км, 10 км, 21 км и 42 км. 5 км подходит новичкам, 10 км - любителям, 21 км - полумарафон, 42 км - полный марафон.', array['дистанции','дистанция','км','забег','маршрут']),
  ('documents', 'Какие документы нужны на старт?', 'Возьмите паспорт или удостоверение личности, телефон, удобную форму, воду и медицинскую справку, если она требуется организатором.', array['документы','паспорт','справка','медицинская']),
  ('registration', 'Как зарегистрироваться?', 'Войдите на сайт через Google или email, заполните анкету, выберите дистанцию, рассчитайте BMI и сохраните заявку.', array['регистрация','заявка','анкета','аккаунт']),
  ('bmi', 'Что такое BMI?', 'BMI - индекс массы тела. На сайте он считается по формуле: вес / рост² и помогает примерно оценить состояние тела перед забегом.', array['bmi','имт','рост','вес','индекс']),
  ('contacts', 'Как связаться с организатором?', 'Напишите вопрос прямо в этот Telegram-чат. Бот сохранит обращение и передаст его администратору Marathon Skills.', array['контакты','помощь','оператор','поддержка']),
  ('schedule', 'Когда проходит старт?', 'Marathon Skills проводится в 2026 году. Сбор участников начинается в 09:00, стартовые пакеты выдаются заранее.', array['старт','время','расписание','год'])
on conflict do nothing;

create table if not exists bot_interactions (
  id uuid primary key default gen_random_uuid(),
  chat_id text not null default '',
  username text not null default '',
  first_name text not null default '',
  last_name text not null default '',
  user_message text not null default '',
  bot_answer text not null default '',
  intent text not null default '',
  confidence numeric(4, 2) not null default 0,
  is_admin_chat boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists bot_interactions_chat_id_idx on bot_interactions (chat_id);
create index if not exists bot_interactions_created_at_idx on bot_interactions (created_at desc);
create index if not exists bot_interactions_intent_idx on bot_interactions (intent);

create or replace view marathon_bot_lookup as
select
  last_name as surname,
  concat(
    'номер ', bib_number,
    ', дистанция ', distance,
    ', статус ', case when status = 'active' then 'допущен' else 'дисквалифицирован' end
  ) as value
from participants;
