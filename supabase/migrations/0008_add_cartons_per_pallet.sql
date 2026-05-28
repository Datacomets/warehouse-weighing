-- v2.7: Record how many cartons the operator placed on one pallet.
--
-- Logged on the remainder ("นับเศษ") step. Pure user input — the app
-- does not compute pallet count from this, it is just captured for
-- reporting (Export CSV) and admin review. Optional, can be NULL.

alter table gr_documents add column if not exists cartons_per_pallet int;
