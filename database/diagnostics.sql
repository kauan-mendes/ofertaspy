-- Aplicado apenas à tabela de pedidos MB WAY.
alter table public.mbway_orders
 add column if not exists provider_summary jsonb,
 add column if not exists last_error_code text;

-- Reaplicar após ALTER TABLE: regras do projeto podem remover grants.
grant select, insert, update on public.mbway_orders to service_role;
revoke all on public.mbway_orders from public,anon,authenticated;
notify pgrst, 'reload schema';
