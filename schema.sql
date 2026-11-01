create table if not exists clientes(
  id bigserial primary key,
  nombre text not null, apellido text not null, telefono text,
  promociones boolean not null default false,
  cumple_dia integer, cumple_mes integer,
  token_hash text unique not null,
  creado timestamptz not null default now(), actualizado timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  check (not promociones or (telefono is not null and cumple_dia is not null and cumple_mes is not null)),
  check ((cumple_dia is null and cumple_mes is null) or (cumple_dia between 1 and 31 and cumple_mes between 1 and 12))
);
create table if not exists consentimientos(
  id bigserial primary key, cliente_id bigint not null references clientes(id),
  aceptado boolean not null, version text not null, texto text not null, telefono text,
  creado timestamptz not null default now()
);
create table if not exists rate_limits(bucket text primary key, hits integer not null, creado timestamptz not null default now());
create table if not exists pedidos(
  id serial primary key, cid text unique, creado timestamptz default now(),
  tipo text not null, mesa text, nombre text, telefono text, direccion text,
  metodo text not null, nota text, items jsonb not null,
  subtotal numeric not null, envio numeric default 0, total numeric not null,
  estado text default 'nuevo', cierre text, receipt text);
create index if not exists pedidos_estado on pedidos(estado, creado);
-- Additive migration: existing orders remain available to staff.
alter table pedidos add column if not exists cliente_id bigint references clientes(id);
alter table pedidos add column if not exists comprobante jsonb;
alter table pedidos add column if not exists notificaciones_whatsapp boolean not null default false;
alter table pedidos add column if not exists sync_state text not null default 'idle';
create index if not exists pedidos_cliente on pedidos(cliente_id, creado);


