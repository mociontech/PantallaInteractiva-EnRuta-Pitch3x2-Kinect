-- EnRuta Empresarial · base central de las 3 experiencias (pared, tríptico, Insta Face).
-- Ejecutar una vez en Supabase: SQL Editor -> pegar -> Run. Es idempotente (se puede volver a correr).
--
-- Acceso: solo con la clave de servicio (service_role) desde los servidores y la función de Netlify.
-- Las tablas tienen RLS activado y SIN políticas: anon/authenticated no pueden leer ni escribir nada (hay cédulas y nombres).

create extension if not exists pgcrypto;

-- Base de asistentes (hoy el CSV de colaboradores; luego la sincroniza la API de Google).
create table if not exists public.attendees (
  cedula      text primary key,                 -- solo dígitos
  nombre      text not null,                    -- ya formateado (Nombres Apellidos)
  cargo       text not null default '',
  origen      text not null default 'base',     -- 'base' (Sheet/CSV) | 'nuevo' (registrado en tablet)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Un resultado por partida/sesión de cualquiera de las experiencias.
create table if not exists public.results (
  id               uuid primary key default gen_random_uuid(),
  idempotency_key  text not null unique,        -- evita duplicados al reintentar
  cedula           text not null,
  experience       text not null check (experience in ('pared', 'triptico', 'insta')),
  score            integer not null check (score >= 0),
  completed        boolean not null default true,
  details          jsonb not null default '{}'::jsonb,   -- áreas, aciertos, duración, etc.
  device_id        text,
  played_at        timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  evius_sent_at    timestamptz                   -- vacío = aún no llegó a Evius (el barredor de la pared lo reintenta)
);
create index if not exists results_cedula_idx on public.results (cedula);
create index if not exists results_evius_pending_idx on public.results (created_at) where evius_sent_at is null;
create index if not exists results_experience_idx on public.results (experience, played_at desc);

-- Ranking: suma de todos los puntos por cédula (igual que Evius, que acumula cada participación).
create or replace view public.ranking with (security_invoker = true) as
select
  r.cedula,
  coalesce(a.nombre, r.cedula)                                   as nombre,
  coalesce(a.cargo, '')                                          as cargo,
  sum(r.score)::int                                              as total,
  count(*)::int                                                  as partidas,
  count(distinct r.experience)::int                              as experiencias,
  coalesce(sum(r.score) filter (where r.experience = 'pared'), 0)::int    as pared,
  coalesce(sum(r.score) filter (where r.experience = 'triptico'), 0)::int as triptico,
  coalesce(sum(r.score) filter (where r.experience = 'insta'), 0)::int    as insta,
  max(r.played_at)                                               as ultima
from public.results r
left join public.attendees a on a.cedula = r.cedula
group by r.cedula, a.nombre, a.cargo
order by total desc, ultima asc;

-- Seguridad: nada público.
alter table public.attendees enable row level security;
alter table public.results   enable row level security;
revoke all on public.attendees, public.results, public.ranking from anon, authenticated;
grant  all on public.attendees, public.results, public.ranking to service_role;
