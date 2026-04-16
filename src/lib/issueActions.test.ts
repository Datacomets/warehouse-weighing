import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  normalizeIssueDraft,
  uploadIssuePhoto,
  createIssue,
  deleteIssue,
  type IssueDraft,
} from "./issueActions";
import { makeFakeFile } from "@/test/supabaseMock";

/** Chainable Supabase mock tailored for issue_reports:
 *    insert(row).select(*).single() → { data, error }
 *    delete().eq(col, val) → { error }
 *    storage.from(bucket).upload(path, file) → { data: {path}, error }
 *    storage.from(bucket).getPublicUrl(path) → { data: { publicUrl } }
 */
function makeIssueMock() {
  const insertSingle = vi.fn().mockResolvedValue({
    data: { id: "issue-1" },
    error: null,
  });
  const insertSelect = vi.fn(() => ({ single: insertSingle }));
  const insert = vi.fn(() => ({ select: insertSelect }));

  const deleteEq = vi.fn().mockResolvedValue({ error: null });
  const deleteFrom = vi.fn(() => ({ eq: deleteEq }));

  const from = vi.fn(() => ({ insert, delete: deleteFrom }));

  const upload = vi.fn().mockResolvedValue({
    data: { path: "doc-1/issues/123-photo.jpg" },
    error: null,
  });
  const getPublicUrl = vi.fn((path: string) => ({
    data: { publicUrl: `https://cdn.example.com/${path}` },
  }));
  const storageFrom = vi.fn(() => ({ upload, getPublicUrl }));

  const client = { from, storage: { from: storageFrom } } as any;

  return {
    client,
    from,
    insert,
    insertSelect,
    insertSingle,
    deleteFrom,
    deleteEq,
    storageFrom,
    upload,
    getPublicUrl,
  };
}

describe("normalizeIssueDraft()", () => {
  const baseDraft: IssueDraft = {
    issue_type: "damaged",
    defect_code: "",
    quantity: "",
    notes: "",
  };

  it("converts empty defect_code/notes to null", () => {
    expect(normalizeIssueDraft(baseDraft)).toEqual({
      issue_type: "damaged",
      defect_code: null,
      quantity: null,
      notes: null,
    });
  });

  it("converts numeric quantity string to number", () => {
    const result = normalizeIssueDraft({ ...baseDraft, quantity: "15" });
    expect(result.quantity).toBe(15);
  });

  it("keeps non-empty defect_code as string", () => {
    const result = normalizeIssueDraft({ ...baseDraft, defect_code: "DEF-001" });
    expect(result.defect_code).toBe("DEF-001");
  });

  it("non-numeric quantity becomes null (not NaN)", () => {
    const result = normalizeIssueDraft({ ...baseDraft, quantity: "abc" });
    expect(result.quantity).toBeNull();
  });

  it("zero quantity is preserved as 0 (not coerced to null)", () => {
    const result = normalizeIssueDraft({ ...baseDraft, quantity: "0" });
    expect(result.quantity).toBe(0);
  });
});

describe("uploadIssuePhoto()", () => {
  let sb: ReturnType<typeof makeIssueMock>;
  beforeEach(() => {
    sb = makeIssueMock();
  });

  it("uploads to gr-photos bucket with {docId}/issues/{ts}-{name} path", async () => {
    const file = makeFakeFile({ name: "broken.jpg", type: "image/jpeg" });
    const result = await uploadIssuePhoto(sb.client, {
      documentId: "doc-1",
      file,
      nowMs: 1700000000000,
    });

    expect(result).toEqual({
      ok: true,
      data: "https://cdn.example.com/doc-1/issues/123-photo.jpg",
    });
    expect(sb.storageFrom).toHaveBeenCalledWith("gr-photos");
    expect(sb.upload).toHaveBeenCalledWith("doc-1/issues/1700000000000-broken.jpg", file);
  });

  it("returns error when storage upload fails", async () => {
    sb.upload.mockResolvedValue({ data: null, error: { message: "quota exceeded" } });

    const result = await uploadIssuePhoto(sb.client, {
      documentId: "doc-1",
      file: makeFakeFile(),
    });

    expect(result).toEqual({ ok: false, error: "quota exceeded" });
    expect(sb.getPublicUrl).not.toHaveBeenCalled();
  });
});

describe("createIssue()", () => {
  let sb: ReturnType<typeof makeIssueMock>;
  const baseInput = {
    documentId: "doc-1",
    userId: "user-1",
    draft: {
      issue_type: "damaged",
      defect_code: "DEF-002",
      quantity: "5",
      notes: "box crushed",
    } as IssueDraft,
    photoUrls: ["https://cdn.example.com/a.jpg"],
  };

  beforeEach(() => {
    sb = makeIssueMock();
  });

  it("inserts with normalized payload + photos + created_by", async () => {
    const result = await createIssue(sb.client, baseInput);

    expect(result).toEqual({ ok: true, data: { id: "issue-1" } });
    expect(sb.from).toHaveBeenCalledWith("issue_reports");
    expect(sb.insert).toHaveBeenCalledWith({
      document_id: "doc-1",
      issue_type: "damaged",
      defect_code: "DEF-002",
      quantity: 5,
      notes: "box crushed",
      photos: ["https://cdn.example.com/a.jpg"],
      created_by: "user-1",
    });
  });

  it("coerces empty draft fields to null before inserting", async () => {
    await createIssue(sb.client, {
      ...baseInput,
      draft: {
        issue_type: "missing",
        defect_code: "",
        quantity: "",
        notes: "",
      },
      photoUrls: [],
    });

    expect(sb.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        defect_code: null,
        quantity: null,
        notes: null,
        photos: [],
      })
    );
  });

  it("accepts null userId (preserves permissive behavior)", async () => {
    await createIssue(sb.client, { ...baseInput, userId: null });
    expect(sb.insert).toHaveBeenCalledWith(
      expect.objectContaining({ created_by: null })
    );
  });

  it("returns error when insert fails", async () => {
    sb.insertSingle.mockResolvedValue({
      data: null,
      error: { message: "fk constraint" },
    });

    const result = await createIssue(sb.client, baseInput);
    expect(result).toEqual({ ok: false, error: "fk constraint" });
  });
});

describe("deleteIssue()", () => {
  let sb: ReturnType<typeof makeIssueMock>;
  beforeEach(() => {
    sb = makeIssueMock();
  });

  it("deletes from issue_reports by id", async () => {
    const result = await deleteIssue(sb.client, "issue-1");

    expect(result).toEqual({ ok: true });
    expect(sb.from).toHaveBeenCalledWith("issue_reports");
    expect(sb.deleteFrom).toHaveBeenCalled();
    expect(sb.deleteEq).toHaveBeenCalledWith("id", "issue-1");
  });

  it("returns error when delete fails", async () => {
    sb.deleteEq.mockResolvedValue({ error: { message: "row locked" } });

    const result = await deleteIssue(sb.client, "issue-1");
    expect(result).toEqual({ ok: false, error: "row locked" });
  });
});
