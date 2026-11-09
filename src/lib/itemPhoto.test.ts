import { describe, it, expect, vi } from "vitest";
import { itemPhotoFolder, buildItemPhotoPath, findItemPhoto, uploadItemPhoto } from "./itemPhoto";
import { makeFakeFile } from "@/test/supabaseMock";

function storageMock(listData: { name: string }[] = []) {
  const list = vi.fn().mockResolvedValue({ data: listData, error: null });
  const upload = vi.fn(async (path: string) => ({ data: { path }, error: null }));
  const getPublicUrl = vi.fn((path: string) => ({ data: { publicUrl: `https://cdn.example.com/${path}` } }));
  const storageFrom = vi.fn(() => ({ list, upload, getPublicUrl }));
  return { client: { storage: { from: storageFrom } } as any, list, upload, storageFrom };
}

describe("itemPhotoFolder()", () => {
  it("keeps normal SAP codes as-is", () => {
    expect(itemPhotoFolder("1211778")).toBe("items/1211778");
    expect(itemPhotoFolder("1210159-1")).toBe("items/1210159-1");
    expect(itemPhotoFolder("TN_RM_BOM-001")).toBe("items/TN_RM_BOM-001");
  });
  it("trims and escapes characters that are unsafe in storage keys", () => {
    expect(itemPhotoFolder(" 12/34 ")).toBe("items/12_2f34");
    expect(itemPhotoFolder("A B")).toBe("items/A_20B");
  });
});

describe("buildItemPhotoPath()", () => {
  it("puts a timestamped file inside the item folder", () => {
    expect(buildItemPhotoPath("1211778", 1700000000000)).toBe("items/1211778/1700000000000.jpg");
  });
});

describe("findItemPhoto()", () => {
  it("returns null when the folder is empty", async () => {
    const m = storageMock([]);
    expect(await findItemPhoto(m.client, "1211778")).toBeNull();
    expect(m.storageFrom).toHaveBeenCalledWith("gr-photos");
    expect(m.list).toHaveBeenCalledWith("items/1211778", { limit: 1, sortBy: { column: "name", order: "desc" } });
  });
  it("returns the public URL of the newest file", async () => {
    const m = storageMock([{ name: "1700000000999.jpg" }]);
    expect(await findItemPhoto(m.client, "1211778")).toBe("https://cdn.example.com/items/1211778/1700000000999.jpg");
  });
  it("ignores placeholder files and blank codes", async () => {
    expect(await findItemPhoto(storageMock([{ name: ".emptyFolderPlaceholder" }]).client, "1")).toBeNull();
    const m = storageMock([{ name: "x.jpg" }]);
    expect(await findItemPhoto(m.client, "   ")).toBeNull();
    expect(m.list).not.toHaveBeenCalled();
  });
});

describe("uploadItemPhoto()", () => {
  it("rejects non-image files without uploading", async () => {
    const m = storageMock();
    const res = await uploadItemPhoto(m.client, { itemCode: "1211778", file: makeFakeFile({ name: "a.pdf" }) });
    expect(res.ok).toBe(false);
    expect(m.upload).not.toHaveBeenCalled();
  });
  it("requires an item code", async () => {
    const m = storageMock();
    const res = await uploadItemPhoto(m.client, { itemCode: " ", file: makeFakeFile({ name: "a.jpg", type: "image/jpeg" }) });
    expect(res).toEqual({ ok: false, error: "กรุณากรอก Item Code ก่อน" });
  });
  it("uploads to items/{code}/{ts}.jpg without overwriting and returns the URL", async () => {
    const m = storageMock();
    const file = makeFakeFile({ name: "a.jpg", type: "image/jpeg", size: 2048 });
    const res = await uploadItemPhoto(m.client, { itemCode: "1211778", file, nowMs: 42 });
    expect(m.upload).toHaveBeenCalledWith("items/1211778/42.jpg", file, expect.objectContaining({ upsert: false, contentType: "image/jpeg" }));
    expect(res).toEqual({ ok: true, url: "https://cdn.example.com/items/1211778/42.jpg" });
  });
});
