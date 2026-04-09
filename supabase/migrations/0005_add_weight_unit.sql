-- Add weight_unit column: kg (default), g, pcs
alter table gr_documents add column if not exists weight_unit text not null default 'kg';
