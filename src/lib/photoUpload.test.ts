import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  validateWeightPhoto,
  buildWeightPhotoPath,
  uploadWeightPhoto,
  deleteWeightPhoto,
  WEIGHT_PHOTO_MAX_SIZE,
  WEIGHT_PHOTO_ALLOWED_TYPES,
} from "./photoUpload";
import { makeFakeFile } from "@/test/supabaseMock";

function makePhotoMock() {
  const upload = vi.fn().mockResolvedValue({
    data: { path: "doc-1/per_pcs/123-pic.jpg" },
    error: null,
  });
  const getPublicUrl = vi.fn((path: string) => ({
    data: { publicUrl: `https://cdn.example.com/${path}` },
  }));
  const storageFrom = vi.fn(() => ({ upload, getPublicUrl }));

  const insertSingle = vi.fn().mockResolvedValue({
    data: { id: "photo-1", url: "https://cdn.example.com/doc-1/per_pcs/123-pic.jpg" },
    error: null,
  });
  const insertSelect = vi.fn(() => ({ single: insertSingle }));
  const insert = vi.fn(() => ({ select: insertSelect }));

  const deleteEq = vi.fn().mockResolvedValue({ error: null });
  const deleteFrom = vi.fn(() => ({ eq: deleteEq }));

  const from = vi.fn(() => ({ insert, delete: deleteFrom }));
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

describe("validateWeightPhoto()", () => {
  it.each(WEIGHT_PHOTO_ALLOWED_TYPES)("accepts %s", (type) => {
    expect(validateWeightPhoto({ name: "a", type, size: 1024 })).toBeNull();
  });

  it("accepts HEIC/HEIF (iPhone default format) even though alert text doesn't mention them", () => {
    expect(validateWeightPhoto({ name: "a", type: "image/heic", size: 1024 })).toBeNull();
    expect(validateWeightPhoto({ name: "a", type: "image/heif", size: 1024 })).toBeNull();
  });

  it("rejects unsupported types with Thai error message containing the filename", () => {
    const err = validateWeightPhoto({ name: "doc.gif", type: "image/gif", size: 1024 });
    expect(err).toBe(`ไฟล์ "doc.gif" ไม่ใช่รูปภาพที่รองรับ (JPEG, PNG, WEBP)`);
  });

  it("rejects application/pdf (this uploader is photos only)", () => {
    const err = validateWeightPhoto({ name: "x.pdf", type: "application/pdf", size: 1024 });
    expect(err).toContain("ไม่ใช่รูปภาพ");
  });

  it("accepts file at exactly 10 MB boundary", () => {
    expect(
      validateWeightPhoto({ name: "big.jpg", type: "image/jpeg", size: WEIGHT_PHOTO_MAX_SIZE })
    ).toBeNull();
  });

  it("rejects file 1 byte over 10 MB", () => {
    const err = validateWeightPhoto({
      name: "huge.jpg",
      type: "image/jpeg",
      size: WEIGHT_PHOTO_MAX_SIZE + 1,
    });
    expect(err).toBe(`ไฟล์ "huge.jpg" ใหญ่เกิน 10 MB`);
  });

  it("reports type error before size error (type check first)", () => {
    const err = validateWeightPhoto({
      name: "x.gif",
      type: "image/gif",
      size: WEIGHT_PHOTO_MAX_SIZE + 999_999,
    });
    expect(err).toContain("ไม่ใช่รูปภาพ");
  });
});

describe("buildWeightPhotoPath()", () => {
  it("uses kind when provided", () => {
    const path = buildWeightPhotoPath({
      documentId: "doc-1",
      kind: "per_pcs",
      nowMs: 1700000000000,
      filename: "a.jpg",
    });
    expect(path).toBe("doc-1/per_pcs/1700000000000-a.jpg");
  });

  it("falls back to 'general' when kind is undefined/null", () => {
    expect(
      buildWeightPhotoPath({
        documentId: "doc-1",
        kind: undefined,
        nowMs: 1,
        filename: "a.jpg",
      })
    ).toBe("doc-1/general/1-a.jpg");
    expect(
      buildWeightPhotoPath({
        documentId: "doc-1",
        kind: null,
        nowMs: 1,
        filename: "a.jpg",
      })
    ).toBe("doc-1/general/1-a.jpg");
  });

  it("preserves filename verbatim (including spaces, non-ASCII)", () => {
    const path = buildWeightPhotoPath({
      documentId: "doc-1",
      nowMs: 100,
      filename: "รูปที่ 1.jpg",
    });
    expect(path).toBe("doc-1/general/100-รูปที่ 1.jpg");
  });
});

describe("uploadWeightPhoto()", () => {
  let sb: ReturnType<typeof makePhotoMock>;
  beforeEach(() => {
    sb = makePhotoMock();
  });

  it("rejects invalid file without hitting Storage", async () => {
    const result = await uploadWeightPhoto(sb.client, {
      documentId: "doc-1",
      kind: "per_pcs",
      file: makeFakeFile({ type: "image/gif" }),
    });

    expect(result.ok).toBe(false);
    expect(sb.upload).not.toHaveBeenCalled();
    expect(sb.from).not.toHaveBeenCalled();
  });

  it("uploads to gr-photos bucket with correct path + cacheControl/upsert options", async () => {
    const file = makeFakeFile({ name: "pic.jpg", type: "image/jpeg" });
    const result = await uploadWeightPhoto(sb.client, {
      documentId: "doc-1",
      kind: "per_pcs",
      file,
      nowMs: 1700000000000,
    });

    expect(result).toEqual({
      ok: true,
      data: {
        id: "photo-1",
        url: "https://cdn.example.com/doc-1/per_pcs/123-pic.jpg",
      },
    });
    expect(sb.storageFrom).toHaveBeenCalledWith("gr-photos");
    expect(sb.upload).toHaveBeenCalledWith(
      "doc-1/per_pcs/1700000000000-pic.jpg",
      file,
      { cacheControl: "3600", upsert: false }
    );
  });

  it("inserts weight_photos row with {document_id, kind, url}", async () => {
    await uploadWeightPhoto(sb.client, {
      documentId: "doc-1",
      kind: "per_inner",
      file: makeFakeFile({ type: "image/png" }),
    });

    expect(sb.from).toHaveBeenCalledWith("weight_photos");
    expect(sb.insert).toHaveBeenCalledWith({
      document_id: "doc-1",
      kind: "per_inner",
      url: "https://cdn.example.com/doc-1/per_pcs/123-pic.jpg",
    });
  });

  it("returns error when Storage upload fails (no DB insert)", async () => {
    sb.upload.mockResolvedValue({ data: null, error: { message: "bucket full" } });

    const result = await uploadWeightPhoto(sb.client, {
      documentId: "doc-1",
      file: makeFakeFile({ type: "image/jpeg" }),
    });

    expect(result.ok).toBe(false);
    // Error passes through translator; unknown "bucket full" message stays as-is
    if (!result.ok) expect(result.error).toBe("bucket full");
    expect(sb.from).not.toHaveBeenCalled();
  });

  it("returns error when DB insert fails (Storage file is orphaned — known behavior)", async () => {
    sb.insertSingle.mockResolvedValue({
      data: null,
      error: { message: "fk violation" },
    });

    const result = await uploadWeightPhoto(sb.client, {
      documentId: "doc-1",
      file: makeFakeFile({ type: "image/jpeg" }),
    });

    expect(result).toEqual({ ok: false, error: "fk violation" });
    // Storage upload still happened — matches current component behavior.
    expect(sb.upload).toHaveBeenCalled();
  });
});

describe("deleteWeightPhoto()", () => {
  let sb: ReturnType<typeof makePhotoMock>;
  beforeEach(() => {
    sb = makePhotoMock();
  });

  it("deletes from weight_photos by id", async () => {
    const result = await deleteWeightPhoto(sb.client, "photo-1");
    expect(result).toEqual({ ok: true });
    expect(sb.from).toHaveBeenCalledWith("weight_photos");
    expect(sb.deleteEq).toHaveBeenCalledWith("id", "photo-1");
  });

  it("returns error when delete fails", async () => {
    sb.deleteEq.mockResolvedValue({ error: { message: "row locked" } });
    const result = await deleteWeightPhoto(sb.client, "photo-1");
    expect(result).toEqual({ ok: false, error: "row locked" });
  });
});
