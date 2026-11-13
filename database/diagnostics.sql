-- Aplicado apenas à tabela de pedidos MB WAY.
alter table public.mbway_orders
 add column if not exists provider_summary jsonb,
 add column if not exists last_error_code text;
