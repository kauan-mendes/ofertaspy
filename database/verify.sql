-- Consulta de verificação, no projeto CAJU selecionado.
select current_database() as database_name,
 (select relrowsecurity from pg_class where oid='public.mbway_orders'::regclass) as rls_enabled,
 has_table_privilege('anon','public.mbway_orders','select') as anon_can_read,
 has_table_privilege('authenticated','public.mbway_orders','select') as users_can_read,
 has_table_privilege('service_role','public.mbway_orders','select') as server_can_read,
 has_function_privilege('anon','public.mbway_reserve_order(uuid,text,text)','execute') as anon_can_reserve,
 has_function_privilege('service_role','public.mbway_reserve_order(uuid,text,text)','execute') as server_can_reserve;
-- Esperado: rls_enabled=true; anon/users=false; server=true; anon_can_reserve=false.
