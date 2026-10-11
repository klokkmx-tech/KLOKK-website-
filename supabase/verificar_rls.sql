-- A24 en vivo · Pégalo en el editor SQL del proyecto del demo.
-- Esperado: todas las tablas con rls = true y politicas = 0.

select
  c.relname                                   as tabla,
  c.relrowsecurity                            as rls,
  count(p.polname)                            as politicas,
  has_table_privilege('anon', c.oid, 'SELECT')          as anon_select,
  has_table_privilege('authenticated', c.oid, 'SELECT') as authenticated_select
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policy p on p.polrelid = c.oid
where n.nspname = 'public' and c.relkind = 'r'
group by c.relname, c.relrowsecurity, c.oid
order by c.relname;
