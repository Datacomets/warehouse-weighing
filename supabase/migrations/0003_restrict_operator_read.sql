-- #9 Restrict operator to only see their own documents
-- Other roles (qc, admin_sap, admin, manager) can see all

drop policy if exists "gr read all" on gr_documents;

create policy "gr read by role" on gr_documents for select using (
  current_role_name() in ('admin', 'admin_sap', 'qc', 'manager')
  or created_by = auth.uid()
);
