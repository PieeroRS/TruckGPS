-- TruckGPS — gestión de perfiles (supervisores) + rol Thomas

-- ---------------------------------------------------------------------------
-- Thomas como supervisor
-- ---------------------------------------------------------------------------
update public.profiles
set role = 'supervisor'
where lower(email) = lower('thomasrv543@gmail.com');

-- Nuevos registros por defecto: conductor (supervisor asigna rol al crear)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'conductor')
  );
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Solo supervisores/admin pueden cambiar roles ajenos
-- ---------------------------------------------------------------------------
create or replace function public.profiles_guard_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role
    and auth.uid() = old.id
    and public.current_user_role() not in ('admin', 'supervisor') then
    raise exception 'No puedes cambiar tu propio rol';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_role_guard on public.profiles;
create trigger profiles_role_guard
  before update on public.profiles
  for each row execute function public.profiles_guard_role_change();

-- Supervisores editan cualquier perfil
drop policy if exists profiles_update_supervisor on public.profiles;
create policy profiles_update_supervisor on public.profiles
  for update to authenticated
  using (public.current_user_role() in ('admin', 'supervisor'))
  with check (public.current_user_role() in ('admin', 'supervisor'));

-- Usuarios editan su propio nombre (el trigger protege el rol)
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());
