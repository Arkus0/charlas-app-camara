-- Ajustes del servidor que genera la propia Edge Function (por ejemplo, sus claves VAPID para los avisos push:
-- la clave privada nunca sale del servidor). Solo la clave de servicio puede leerlos.
create table public.ajustes (
  clave text primary key,
  valor jsonb not null,
  creado timestamptz not null default now()
);

alter table public.ajustes enable row level security;
revoke all on table public.ajustes from anon, authenticated;
