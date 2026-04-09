-- Add remainder_pcs column to gr_documents for counting leftover pieces
alter table gr_documents add column if not exists remainder_pcs int;
