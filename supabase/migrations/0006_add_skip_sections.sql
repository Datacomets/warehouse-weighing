-- Allow operators to mark a weighing tab as "not applicable" instead of
-- requiring at least one measurement. Each of the three weighing kinds
-- gets its own boolean + reason text, so an audit can see why it was skipped.
alter table gr_documents
  add column if not exists skip_per_pcs     boolean not null default false,
  add column if not exists skip_per_inner   boolean not null default false,
  add column if not exists skip_per_carton  boolean not null default false,
  add column if not exists skip_reason_per_pcs    text,
  add column if not exists skip_reason_per_inner  text,
  add column if not exists skip_reason_per_carton text;
