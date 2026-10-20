-- Panel de Vida: esquema inicial
-- Todas las tablas tienen Row Level Security: cada fila solo es visible
-- para el usuario cuyo id coincide con user_id.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Función auxiliar: mantiene updated_at al día
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  titulo text not null check (char_length(titulo) between 1 and 300),
  descripcion text,
  fecha_limite date,
  prioridad text not null default 'media'
    check (prioridad in ('alta', 'media', 'baja')),
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'en_progreso', 'hecha')),
  proyecto text,
  created_at timestamptz not null default now()
);

create index tasks_user_estado_fecha_idx
  on public.tasks (user_id, estado, fecha_limite);

alter table public.tasks enable row level security;

create policy "tasks: ver propias" on public.tasks
  for select to authenticated
  using (user_id = auth.uid());

create policy "tasks: crear propias" on public.tasks
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "tasks: editar propias" on public.tasks
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "tasks: borrar propias" on public.tasks
  for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- email_classifications
-- ---------------------------------------------------------------------------
create table public.email_classifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  gmail_thread_id text not null,
  categoria text not null
    check (categoria in ('responder_hoy', 'esperando_respuesta', 'informativo')),
  resumen_una_linea text,
  fecha_limite_detectada date,
  updated_at timestamptz not null default now(),
  unique (user_id, gmail_thread_id)
);

create index email_classifications_user_categoria_idx
  on public.email_classifications (user_id, categoria);

create trigger email_classifications_set_updated_at
  before update on public.email_classifications
  for each row execute function public.set_updated_at();

alter table public.email_classifications enable row level security;

create policy "email_classifications: ver propias" on public.email_classifications
  for select to authenticated
  using (user_id = auth.uid());

create policy "email_classifications: crear propias" on public.email_classifications
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "email_classifications: editar propias" on public.email_classifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "email_classifications: borrar propias" on public.email_classifications
  for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- daily_briefs
-- ---------------------------------------------------------------------------
create table public.daily_briefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  fecha date not null,
  contenido_markdown text not null,
  enviado boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, fecha)
);

alter table public.daily_briefs enable row level security;

create policy "daily_briefs: ver propios" on public.daily_briefs
  for select to authenticated
  using (user_id = auth.uid());

create policy "daily_briefs: crear propios" on public.daily_briefs
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "daily_briefs: editar propios" on public.daily_briefs
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "daily_briefs: borrar propios" on public.daily_briefs
  for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- integrations
-- El refresh token (cifrado) solo lo lee y escribe el servidor con la
-- service role. El navegador, con sesión de usuario, puede ver únicamente
-- las columnas no sensibles para mostrar el estado de las conexiones.
-- ---------------------------------------------------------------------------
create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  proveedor text not null,
  refresh_token_cifrado text,
  ultima_sincronizacion timestamptz,
  unique (user_id, proveedor)
);

alter table public.integrations enable row level security;

create policy "integrations: ver propias" on public.integrations
  for select to authenticated
  using (user_id = auth.uid());

revoke all on public.integrations from anon, authenticated;
grant select (id, user_id, proveedor, ultima_sincronizacion)
  on public.integrations to authenticated;
