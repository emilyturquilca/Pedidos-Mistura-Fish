create table if not exists pedidos(
  id serial primary key, cid text unique, creado timestamptz default now(),
  tipo text not null, mesa text, nombre text, telefono text, direccion text,
  metodo text not null, nota text, items jsonb not null,
  subtotal numeric not null, envio numeric default 0, total numeric not null,
  estado text default 'nuevo', cierre text, receipt text);
create index if not exists pedidos_estado on pedidos(estado, creado);
