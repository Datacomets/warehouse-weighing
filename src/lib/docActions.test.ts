import { describe, it, expect, beforeEach } from "vitest";
import {
  submitDocument,
  unlockDocument,
  recallSubmission,
  completeSapEntry,
} from "./docActions";
import { makeSupabaseMock, makeFakeFile } from "@/test/supabaseMock";

describe("submitDocument()", () => {
  let sb: ReturnType<typeof makeSupabaseMock>;
  beforeEach(() => {
    sb = makeSupabaseMock();
  });

  it("updates gr_documents to pending_sap with timestamps + actor", async () => {
    const now = new Date("2026-04-16T10:30:00Z");
    const result = await submitDocument(sb.client, { docId: "doc-1", userId: "user-1", now });

    expect(result).toEqual({ ok: true });
    expect(sb.from).toHaveBeenCalledWith("gr_documents");
    expect(sb.update).toHaveBeenCalledWith({
      status: "pending_sap",
      submitted_by: "user-1",
      submitted_at: "2026-04-16T10:30:00.000Z",
      ended_at: "2026-04-16T10:30:00.000Z",
    });
    expect(sb.updateEq).toHaveBeenCalledWith("id", "doc-1");
  });

  it("writes an audit_log entry with action=submit_work", async () => {
    await submitDocument(sb.client, { docId: "doc-1", userId: "user-1" });

    expect(sb.from).toHaveBeenCalledWith("audit_log");
    expect(sb.insert).toHaveBeenCalledWith({
      document_id: "doc-1",
      actor: "user-1",
      action: "submit_work",
    });
  });

  it("does not write audit_log when the update fails", async () => {
    sb.updateEq.mockResolvedValue({ error: { message: "row locked" } });

    const result = await submitDocument(sb.client, { docId: "doc-1", userId: "user-1" });

    expect(result).toEqual({ ok: false, error: "row locked" });
    expect(sb.insert).not.toHaveBeenCalled();
  });

  it("accepts null userId (preserves current loose-null behavior)", async () => {
    const result = await submitDocument(sb.client, { docId: "doc-1", userId: null });

    expect(result).toEqual({ ok: true });
    expect(sb.update).toHaveBeenCalledWith(expect.objectContaining({ submitted_by: null }));
    expect(sb.insert).toHaveBeenCalledWith(expect.objectContaining({ actor: null }));
  });
});

describe("unlockDocument()", () => {
  let sb: ReturnType<typeof makeSupabaseMock>;
  beforeEach(() => {
    sb = makeSupabaseMock();
  });

  it("rejects empty reason without touching the DB", async () => {
    const result = await unlockDocument(sb.client, {
      docId: "doc-1",
      userId: "user-1",
      reason: "",
    });

    expect(result).toEqual({ ok: false, error: "กรุณากรอกเหตุผล" });
    expect(sb.from).not.toHaveBeenCalled();
  });

  it("rejects whitespace-only reason", async () => {
    const result = await unlockDocument(sb.client, {
      docId: "doc-1",
      userId: "user-1",
      reason: "   ",
    });
    expect(result.ok).toBe(false);
    expect(sb.from).not.toHaveBeenCalled();
  });

  it("reverts doc to in_progress and clears submitted/ended timestamps", async () => {
    const result = await unlockDocument(sb.client, {
      docId: "doc-1",
      userId: "admin-1",
      reason: "พนักงานกรอกผิด",
    });

    expect(result).toEqual({ ok: true });
    expect(sb.update).toHaveBeenCalledWith({
      status: "in_progress",
      unlock_reason: "พนักงานกรอกผิด",
      submitted_at: null,
      ended_at: null,
    });
    expect(sb.updateEq).toHaveBeenCalledWith("id", "doc-1");
  });

  it("logs audit entry with reason in detail", async () => {
    await unlockDocument(sb.client, {
      docId: "doc-1",
      userId: "admin-1",
      reason: "พนักงานกรอกผิด",
    });

    expect(sb.insert).toHaveBeenCalledWith({
      document_id: "doc-1",
      actor: "admin-1",
      action: "unlock",
      detail: { reason: "พนักงานกรอกผิด" },
    });
  });

  it("does not write audit log if update fails", async () => {
    sb.updateEq.mockResolvedValue({ error: { message: "constraint violation" } });

    const result = await unlockDocument(sb.client, {
      docId: "doc-1",
      userId: "admin-1",
      reason: "test",
    });

    expect(result).toEqual({ ok: false, error: "constraint violation" });
    expect(sb.insert).not.toHaveBeenCalled();
  });
});

describe("recallSubmission()", () => {
  let sb: ReturnType<typeof makeSupabaseMock>;
  beforeEach(() => {
    sb = makeSupabaseMock();
  });

  it("reverts pending_sap doc to in_progress and clears timestamps", async () => {
    const result = await recallSubmission(sb.client, { docId: "doc-1", userId: "user-1" });

    expect(result).toEqual({ ok: true });
    expect(sb.update).toHaveBeenCalledWith({
      status: "in_progress",
      submitted_at: null,
      ended_at: null,
    });
    // Chained .eq calls: first for id, second for status, third for submitted_by
    expect(sb.updateEq).toHaveBeenCalledWith("id", "doc-1");
    expect(sb.updateEq).toHaveBeenCalledWith("status", "pending_sap");
    expect(sb.updateEq).toHaveBeenCalledWith("submitted_by", "user-1");
  });

  it("writes audit_log with action=recall_submission", async () => {
    await recallSubmission(sb.client, { docId: "doc-1", userId: "user-1" });

    expect(sb.from).toHaveBeenCalledWith("audit_log");
    expect(sb.insert).toHaveBeenCalledWith({
      document_id: "doc-1",
      actor: "user-1",
      action: "recall_submission",
    });
  });

  it("does not write audit_log when update fails", async () => {
    sb.updateEq.mockImplementation(() => {
      const chainable: any = Promise.resolve({ error: { message: "not found" } });
      chainable.eq = sb.updateEq;
      return chainable;
    });

    const result = await recallSubmission(sb.client, { docId: "doc-1", userId: "user-1" });

    expect(result).toEqual({ ok: false, error: "not found" });
    expect(sb.insert).not.toHaveBeenCalled();
  });
});

describe("completeSapEntry()", () => {
  let sb: ReturnType<typeof makeSupabaseMock>;
  const baseInput = {
    doc: { id: "doc-1", sap_attachment_url: null },
    cfsd: "CFSD-8634",
    notif: "",
    file: null as File | null,
    userId: "admin-1",
    nowMs: 1_700_000_000_000,
    closedAt: "2026-04-16T10:30:00.000Z",
  };

  beforeEach(() => {
    sb = makeSupabaseMock();
  });

  describe("validation", () => {
    it("rejects missing CFSD before any DB call", async () => {
      const result = await completeSapEntry(sb.client, { ...baseInput, cfsd: "" });

      expect(result).toEqual({ ok: false, error: "กรุณากรอกเลข CFSD" });
      expect(sb.from).not.toHaveBeenCalled();
      expect(sb.upload).not.toHaveBeenCalled();
    });

    it("rejects disallowed file type before upload", async () => {
      const result = await completeSapEntry(sb.client, {
        ...baseInput,
        file: makeFakeFile({ type: "text/plain" }),
      });

      expect(result.ok).toBe(false);
      expect(sb.upload).not.toHaveBeenCalled();
    });
  });

  describe("happy path — no file", () => {
    it("updates gr_documents → completed and writes audit_log", async () => {
      const result = await completeSapEntry(sb.client, {
        ...baseInput,
        notif: "NOTIF-1",
      });

      expect(result).toEqual({ ok: true, attachmentUrl: null });

      expect(sb.storageFrom).not.toHaveBeenCalled();
      expect(sb.upload).not.toHaveBeenCalled();

      expect(sb.from).toHaveBeenCalledWith("gr_documents");
      expect(sb.update).toHaveBeenCalledWith({
        sap_inbound_id: "CFSD-8634",
        sap_notification_id: "NOTIF-1",
        sap_attachment_url: null,
        status: "completed",
        closed_by: "admin-1",
        closed_at: baseInput.closedAt,
      });

      expect(sb.from).toHaveBeenCalledWith("audit_log");
      expect(sb.insert).toHaveBeenCalledWith({
        document_id: "doc-1",
        actor: "admin-1",
        action: "complete_sap",
        detail: { sap_inbound_id: "CFSD-8634" },
      });
    });

    it("trims CFSD and stores null notification when notif is empty/whitespace", async () => {
      await completeSapEntry(sb.client, {
        ...baseInput,
        cfsd: "  CFSD-8634  ",
        notif: "   ",
      });

      expect(sb.update).toHaveBeenCalledWith(
        expect.objectContaining({
          sap_inbound_id: "CFSD-8634",
          sap_notification_id: null,
        })
      );
    });
  });

  describe("happy path — with file", () => {
    it("uploads to sap-attachments bucket with doc-id/timestamp-name path", async () => {
      const file = makeFakeFile({ name: "invoice.pdf" });
      const result = await completeSapEntry(sb.client, { ...baseInput, file });

      expect(result.ok).toBe(true);
      expect(sb.storageFrom).toHaveBeenCalledWith("sap-attachments");
      expect(sb.upload).toHaveBeenCalledWith(
        "doc-1/1700000000000-invoice.pdf",
        file
      );
    });

    it("persists the returned public URL on the document", async () => {
      sb.upload.mockResolvedValue({ data: { path: "doc-1/abc.pdf" }, error: null });

      const result = await completeSapEntry(sb.client, {
        ...baseInput,
        file: makeFakeFile(),
      });

      expect(sb.getPublicUrl).toHaveBeenCalledWith("doc-1/abc.pdf");
      expect(result).toEqual({
        ok: true,
        attachmentUrl: "https://storage.example.com/doc-1/abc.pdf",
      });
      expect(sb.update).toHaveBeenCalledWith(
        expect.objectContaining({
          sap_attachment_url: "https://storage.example.com/doc-1/abc.pdf",
        })
      );
    });
  });

  describe("error paths", () => {
    it("does NOT update the doc when upload fails", async () => {
      sb.upload.mockResolvedValue({ data: null, error: { message: "bucket full" } });

      const result = await completeSapEntry(sb.client, {
        ...baseInput,
        file: makeFakeFile(),
      });

      // Unknown error messages pass through the translator unchanged
      expect(result).toEqual({ ok: false, error: "bucket full" });
      expect(sb.from).not.toHaveBeenCalled();
      expect(sb.update).not.toHaveBeenCalled();
      expect(sb.insert).not.toHaveBeenCalled();
    });

    it("does NOT write audit_log when the doc update fails (translates RLS → Thai)", async () => {
      sb.updateEq.mockResolvedValue({ error: { message: "row-level security" } });

      const result = await completeSapEntry(sb.client, baseInput);

      expect(result).toEqual({ ok: false, error: "ไม่มีสิทธิ์ดำเนินการนี้" });
      expect(sb.insert).not.toHaveBeenCalled();
    });
  });
});
