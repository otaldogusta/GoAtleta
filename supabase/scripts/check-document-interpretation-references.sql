-- Read-only dependency map for document_interpretations.
-- Used before consolidating duplicated interpretations.

select
  constraint_schema,
  table_name,
  constraint_name,
  column_name
from information_schema.constraint_column_usage
where table_schema = 'public'
  and table_name = 'document_interpretations'
order by constraint_schema, constraint_name;

select
  tc.table_schema as referencing_schema,
  tc.table_name as referencing_table,
  kcu.column_name as referencing_column,
  rc.delete_rule,
  rc.update_rule
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on kcu.constraint_catalog = tc.constraint_catalog
 and kcu.constraint_schema = tc.constraint_schema
 and kcu.constraint_name = tc.constraint_name
join information_schema.referential_constraints rc
  on rc.constraint_catalog = tc.constraint_catalog
 and rc.constraint_schema = tc.constraint_schema
 and rc.constraint_name = tc.constraint_name
join information_schema.constraint_column_usage ccu
  on ccu.constraint_catalog = rc.unique_constraint_catalog
 and ccu.constraint_schema = rc.unique_constraint_schema
 and ccu.constraint_name = rc.unique_constraint_name
where tc.constraint_type = 'FOREIGN KEY'
  and ccu.table_schema = 'public'
  and ccu.table_name = 'document_interpretations'
  and ccu.column_name = 'id'
order by tc.table_schema, tc.table_name, kcu.column_name;

select
  tc.table_schema as referencing_schema,
  tc.table_name as referencing_table,
  kcu.column_name as referencing_column,
  ccu.table_name as referenced_table,
  ccu.column_name as referenced_column,
  rc.delete_rule,
  rc.update_rule
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on kcu.constraint_catalog = tc.constraint_catalog
 and kcu.constraint_schema = tc.constraint_schema
 and kcu.constraint_name = tc.constraint_name
join information_schema.referential_constraints rc
  on rc.constraint_catalog = tc.constraint_catalog
 and rc.constraint_schema = tc.constraint_schema
 and rc.constraint_name = tc.constraint_name
join information_schema.constraint_column_usage ccu
  on ccu.constraint_catalog = rc.unique_constraint_catalog
 and ccu.constraint_schema = rc.unique_constraint_schema
 and ccu.constraint_name = rc.unique_constraint_name
where tc.constraint_type = 'FOREIGN KEY'
  and ccu.table_schema = 'public'
  and ccu.table_name = 'document_context_bindings'
order by tc.table_schema, tc.table_name, kcu.column_name;
