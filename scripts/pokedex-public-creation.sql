-- Preserva a ordem de criação dos registros publicados, inclusive após republicações.
-- As tabelas públicas continuam contendo somente snapshots liberados pelo GM.
alter table public.pokedex_public_species add column if not exists created_at timestamptz;
alter table public.pokedex_public_forms add column if not exists created_at timestamptz;
alter table public.pokedex_public_custom_megas add column if not exists created_at timestamptz;

create or replace function public.pokedex_set_public_created_at()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  source_created_at timestamptz;
begin
  if tg_table_name = 'pokedex_public_species' then
    select s.created_at into source_created_at from public.pokedex_species s where s.id = new.species_id;
  elsif tg_table_name = 'pokedex_public_forms' then
    select f.created_at into source_created_at from public.pokedex_forms f where f.id = new.form_id;
  elsif tg_table_name = 'pokedex_public_custom_megas' then
    select m.created_at into source_created_at from public.pokedex_custom_megas m where m.id = new.mega_id;
  end if;
  new.created_at := coalesce(source_created_at, new.created_at, new.published_at);
  return new;
end;
$$;
revoke all on function public.pokedex_set_public_created_at() from public, anon, authenticated;

drop trigger if exists pokedex_public_created_at on public.pokedex_public_species;
create trigger pokedex_public_created_at before insert or update on public.pokedex_public_species
for each row execute function public.pokedex_set_public_created_at();
drop trigger if exists pokedex_public_created_at on public.pokedex_public_forms;
create trigger pokedex_public_created_at before insert or update on public.pokedex_public_forms
for each row execute function public.pokedex_set_public_created_at();
drop trigger if exists pokedex_public_created_at on public.pokedex_public_custom_megas;
create trigger pokedex_public_created_at before insert or update on public.pokedex_public_custom_megas
for each row execute function public.pokedex_set_public_created_at();

update public.pokedex_public_species p set created_at = s.created_at
from public.pokedex_species s where s.id = p.species_id and p.created_at is null;
update public.pokedex_public_forms p set created_at = f.created_at
from public.pokedex_forms f where f.id = p.form_id and p.created_at is null;
update public.pokedex_public_custom_megas p set created_at = m.created_at
from public.pokedex_custom_megas m where m.id = p.mega_id and p.created_at is null;

