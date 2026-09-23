-- ===================================================================
--  Büroquote – komplettes Schema für eine neue Supabase-Datenbank
--  Einmal im SQL-Editor ausführen. Reihenfolge nicht ändern.
-- ===================================================================

-- 1) Anwesenheitsdaten -----------------------------------------------
--    Eine Zeile pro Nutzer. Alle Jahre und Einstellungen liegen als
--    JSON in "data", genau wie die App sie im Speicher hält.

create table if not exists public.attendance (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.attendance enable row level security;


-- 2) Profile: Benutzername und Admin-Kennzeichen ---------------------

create table if not exists public.profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  username   text not null,
  is_admin   boolean not null default false,
  created_at timestamptz not null default now()
);

-- Benutzername eindeutig, unabhängig von Groß- und Kleinschreibung
create unique index if not exists profiles_username_key
  on public.profiles (lower(username));

alter table public.profiles enable row level security;


-- 3) Hilfsfunktion: ist dieser Nutzer Admin? -------------------------
--    security definer, damit die Policy sich nicht selbst abfragt.

create or replace function public.is_admin(uid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where user_id = uid), false);
$$;


-- 4) Policies für attendance -----------------------------------------

drop policy if exists "eigene zeile" on public.attendance;
create policy "eigene zeile" on public.attendance
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "admin liest alles" on public.attendance;
create policy "admin liest alles" on public.attendance
  for select
  using (public.is_admin(auth.uid()));


-- 5) Policies für profiles -------------------------------------------

drop policy if exists "profil lesen" on public.profiles;
create policy "profil lesen" on public.profiles
  for select
  using (auth.uid() = user_id or public.is_admin(auth.uid()));

-- Anlegen nur für sich selbst und niemals direkt als Admin
drop policy if exists "profil anlegen" on public.profiles;
create policy "profil anlegen" on public.profiles
  for insert
  with check (auth.uid() = user_id and is_admin = false);

drop policy if exists "profil aendern" on public.profiles;
create policy "profil aendern" on public.profiles
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Schutz: is_admin lässt sich nicht selbst setzen
create or replace function public.protect_is_admin()
returns trigger
language plpgsql
as $$
begin
  if new.is_admin is distinct from old.is_admin then
    new.is_admin := old.is_admin;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_is_admin on public.profiles;
create trigger profiles_protect_is_admin
  before update on public.profiles
  for each row execute function public.protect_is_admin();


-- 6) Anmeldung per Benutzername --------------------------------------
--    Liefert die E-Mail zum Benutzernamen, damit sich der Client
--    damit anmelden kann.

create or replace function public.email_for_login(login text)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select u.email
  from public.profiles p
  join auth.users u on u.id = p.user_id
  where lower(p.username) = lower(trim(login))
  limit 1;
$$;

revoke all on function public.email_for_login(text) from public;
grant execute on function public.email_for_login(text) to anon, authenticated;


-- ===================================================================
--  Nach dem ersten Login: Admin ernennen
-- ===================================================================
-- update public.profiles set is_admin = true where lower(username) = lower('DEIN_NAME');

-- Kontrolle, dass überall RLS aktiv ist:
-- select tablename, rowsecurity from pg_tables where schemaname = 'public';
