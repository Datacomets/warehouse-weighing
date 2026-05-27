-- v2.6: Manager joins the roles that can update gr_documents.
--
-- The product workflow now allows admin/admin_sap/MANAGER to edit a
-- `completed` document in place (no status change, doc stays closed).
-- The application layer already gates this via canEditDocumentData()
-- but the database policy still rejected manager UPDATEs, so without
-- this migration the UI lets manager type but the save silently fails.
--
-- Operator's existing rule (own doc + in_progress only) is preserved.

drop policy if exists "gr update by role" on gr_documents;

create policy "gr update by role" on gr_documents for update
  using (
    current_role_name() in ('admin', 'admin_sap', 'qc', 'manager')
    or (created_by = auth.uid() and status = 'in_progress')
  )
  with check (
    current_role_name() in ('admin', 'admin_sap', 'qc', 'manager')
    or created_by = auth.uid()
  );
