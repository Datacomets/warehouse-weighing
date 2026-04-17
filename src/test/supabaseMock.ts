import { vi } from "vitest";

/**
 * Minimal chainable Supabase mock for docActions tests.
 *
 * Supports:
 *   supabase.from(table).update(row).eq(col, val)       → { error }
 *   supabase.from(table).insert(row)                    → { error }
 *   supabase.storage.from(bucket).upload(path, file)    → { data: {path}, error }
 *   supabase.storage.from(bucket).getPublicUrl(path)    → { data: { publicUrl } }
 *
 * Each test configures resolved values per call via the returned spies.
 */
export function makeSupabaseMock() {
  const updateEq: any = vi.fn().mockResolvedValue({ error: null });
  // Support chained .eq().eq() — each .eq() returns { eq: updateEq }
  updateEq.mockImplementation(() => {
    const chainable: any = Promise.resolve({ error: null });
    chainable.eq = updateEq;
    return chainable;
  });
  const update = vi.fn(() => ({ eq: updateEq }));
  const insert = vi.fn().mockResolvedValue({ error: null });

  const from = vi.fn((_table: string) => ({ update, insert }));

  const upload = vi.fn().mockResolvedValue({
    data: { path: "doc-id/123-file.pdf" },
    error: null,
  });
  const getPublicUrl = vi.fn((path: string) => ({
    data: { publicUrl: `https://storage.example.com/${path}` },
  }));
  const storageFrom = vi.fn(() => ({ upload, getPublicUrl }));

  const client = {
    from,
    storage: { from: storageFrom },
  };

  return {
    client: client as any,
    from,
    update,
    updateEq,
    insert,
    storageFrom,
    upload,
    getPublicUrl,
  };
}

/** Build a minimal File-like object without real Blob contents. */
export function makeFakeFile(overrides: Partial<{ name: string; type: string; size: number }> = {}): File {
  const { name = "attachment.pdf", type = "application/pdf", size = 1024 } = overrides;
  // Cast to File — our helpers only read .name, .type, .size and pass the object to Supabase upload.
  return { name, type, size } as unknown as File;
}
