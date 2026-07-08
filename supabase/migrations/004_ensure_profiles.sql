-- TruckGPS — asegurar perfiles para usuarios Auth existentes

-- ---------------------------------------------------------------------------
-- Backfill: usuarios en Auth sin fila en profiles
-- ---------------------------------------------------------------------------
insert into public.profiles (id, full_name, email, role)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
  u.email,
  case
    when lower(u.email) = lower('thomasrv543@gmail.com') then 'supervisor'::user_role
    else coalesce((u.raw_user_meta_data->>'role')::user_role, 'conductor'::user_role)
  end
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

-- Thomas siempre supervisor
update public.profiles
set role = 'supervisor'
where lower(email) = lower('thomasrv543@gmail.com');

-- ---------------------------------------------------------------------------
-- RPC: crear/cargar perfil al iniciar sesión (evita "Sin sesión")
-- ---------------------------------------------------------------------------
create or replace function public.ensure_user_profile()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  u auth.users;
  p public.profiles;
  assigned_role user_role;
begin
  select * into u from auth.users where id = auth.uid();
  if u.id is null then
    raise exception 'No autenticado';
  end if;

  select * into p from public.profiles where id = u.id;
  if found then
    if lower(u.email) = lower('thomasrv543@gmail.com') and p.role is distinct from 'supervisor' then
      update public.profiles set role = 'supervisor' where id = u.id returning * into p;
    end if;
    return p;
  end if;

  assigned_role := case
    when lower(u.email) = lower('thomasrv543@gmail.com') then 'supervisor'::user_role
    else coalesce((u.raw_user_meta_data->>'role')::user_role, 'conductor'::user_role)
  end;

  insert into public.profiles (id, full_name, email, role)
  values (
    u.id,
    coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
    u.email,
    assigned_role
  )
  returning * into p;

  return p;
end;
$$;

grant execute on function public.ensure_user_profile() to authenticated;
