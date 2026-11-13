-- Estrutura MB WAY aplicada no projeto CAJU (zqmtlhqaaueighidwluy) por escolha do utilizador.
-- Não altera tabelas existentes. Não é necessário executar novamente.
begin;
create table if not exists public.mbway_orders (
 id uuid primary key,
 request_key text not null unique,
 token text not null,
 method text not null check (method='mbway'),
 status text not null check (status in ('creating','pending','paid','review','rejected','refunded','chargeback','expired','cancelled')),
 transaction_id text unique,
 verified_total integer not null default 0 check (verified_total in (0,990)),
 created_at bigint not null,
 last_check bigint not null default 0
);
create index if not exists mbway_orders_created_at_idx on public.mbway_orders(created_at);
alter table public.mbway_orders enable row level security;
revoke all on public.mbway_orders from public, anon, authenticated;
grant select, insert, update on public.mbway_orders to service_role;

-- Uma reserva atómica impede POSTs duplicados, mesmo com várias instâncias.
create or replace function public.mbway_reserve_order(p_id uuid,p_key text,p_token text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare o public.mbway_orders; n bigint; now_ms bigint;
begin
 perform pg_advisory_xact_lock(649901331);
 select * into o from public.mbway_orders where request_key=p_key;
 if found then return jsonb_build_object('created',false,'order',to_jsonb(o)); end if;
 now_ms := floor(extract(epoch from clock_timestamp())*1000)::bigint;
 select count(*) into n from public.mbway_orders where created_at>now_ms-3600000;
 if n>=20 then return jsonb_build_object('limited',true); end if;
 insert into public.mbway_orders(id,request_key,token,method,status,created_at)
 values(p_id,p_key,p_token,'mbway','creating',now_ms) returning * into o;
 return jsonb_build_object('created',true,'order',to_jsonb(o));
end $$;
revoke all on function public.mbway_reserve_order(uuid,text,text) from public,anon,authenticated;
grant execute on function public.mbway_reserve_order(uuid,text,text) to service_role;

create or replace function public.mbway_record_status(p_id uuid,p_status text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare o public.mbway_orders;
begin
 select * into o from public.mbway_orders where id=p_id for update;
 if not found then return null; end if;
 -- Não reverter um estado final por causa de uma consulta pendente que chegou atrasada.
 if p_status<>'pending' or o.status in ('creating','pending','review') then
  update public.mbway_orders set status=p_status,last_check=floor(extract(epoch from clock_timestamp())*1000)::bigint where id=p_id returning * into o;
 end if;
 return to_jsonb(o);
end $$;
revoke all on function public.mbway_record_status(uuid,text) from public,anon,authenticated;
grant execute on function public.mbway_record_status(uuid,text) to service_role;
commit;
