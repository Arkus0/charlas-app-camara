-- Modo online por correspondencia. Los clientes no tocan ninguna tabla: todo pasa por la Edge Function `partida`,
-- que usa la clave de servicio, guarda el estado completo (secreto) y entrega a cada jugador solo su vista.
-- Por eso todas las tablas tienen RLS activada sin políticas y sin permisos para anon ni authenticated.

create table public.partidas (
  id uuid primary key,
  codigo text not null unique check (codigo ~ '^[A-HJ-NP-Z2-9]{6}$'),
  version_motor integer not null,
  ritmo smallint not null check (ritmo in (1, 2)),
  n integer not null,
  turno_de text check (turno_de in ('P', 'C')),
  ganador jsonb,
  estado jsonb not null,
  -- huella SHA-256 del token secreto de cada asiento (null: asiento libre)
  token_p text,
  token_c text,
  nombre_p text check (char_length(nombre_p) <= 24),
  nombre_c text check (char_length(nombre_c) <= 24),
  creada timestamptz not null default now(),
  actualizada timestamptz not null default now()
);

create table public.jugadas (
  -- lo genera el cliente: un reintento con el mismo identificador no se aplica dos veces
  jugada_id text primary key check (char_length(jugada_id) <= 64),
  partida_id uuid not null references public.partidas (id) on delete cascade,
  n integer not null,
  bando text not null check (bando in ('P', 'C')),
  respuesta jsonb not null,
  creada timestamptz not null default now()
);
create index jugadas_partida_n on public.jugadas (partida_id, n);

create table public.suscripciones_push (
  partida_id uuid not null references public.partidas (id) on delete cascade,
  bando text not null check (bando in ('P', 'C')),
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  creada timestamptz not null default now(),
  primary key (partida_id, bando, endpoint)
);

alter table public.partidas enable row level security;
alter table public.jugadas enable row level security;
alter table public.suscripciones_push enable row level security;
revoke all on table public.partidas, public.jugadas, public.suscripciones_push from anon, authenticated;

-- Aplica una jugada: nuevo estado y registro de la jugada en la misma transacción, solo si nadie ha jugado
-- desde que se leyó la partida (n). Devuelve 'ok', 'conflicto' o 'repetida'.
create function public.aplicar_jugada(
  p_id uuid,
  p_n integer,
  p_estado jsonb,
  p_turno text,
  p_ganador jsonb,
  p_jugada_id text,
  p_bando text,
  p_respuesta jsonb
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  filas integer;
begin
  if exists (select 1 from public.jugadas where jugada_id = p_jugada_id) then
    return 'repetida';
  end if;
  update public.partidas
     set estado = p_estado,
         n = (p_estado ->> 'n')::integer,
         turno_de = p_turno,
         ganador = p_ganador,
         actualizada = now()
   where id = p_id and n = p_n;
  get diagnostics filas = row_count;
  if filas = 0 then
    return 'conflicto';
  end if;
  insert into public.jugadas (jugada_id, partida_id, n, bando, respuesta)
  values (p_jugada_id, p_id, p_n, p_bando, p_respuesta);
  return 'ok';
exception
  when unique_violation then
    return 'repetida';
end;
$$;

revoke execute on function public.aplicar_jugada(uuid, integer, jsonb, text, jsonb, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.aplicar_jugada(uuid, integer, jsonb, text, jsonb, text, text, jsonb) to service_role;
