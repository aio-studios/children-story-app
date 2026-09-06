// Client-side cover-Blob cleanup (#46, #92 Step 5).
//
// The rule the whole lifecycle rests on: a cover Blob is deleted only once nothing references it any
// more. For a guest the reference is the local continue slot; for a signed-in user it is a row in
// `public.stories`, which outlives the screen. So callers must always remove the reference FIRST
// (clear the slot, delete or overwrite the row) and call this second — never the other way round. A
// Blob deleted ahead of a row that survives is a saved story with a permanently broken cover; an
// orphaned Blob left behind is a fraction of a cent.
//
// The endpoint re-checks that invariant server-side against the database (migration 003), so a
// caller getting the order wrong is refused rather than obeyed.
export function deleteCoverBlob(url: string | null | undefined): void {
  if (!url) return;
  // Fire-and-forget: cleanup is housekeeping and must never block, fail or interrupt a story that is
  // already on screen. A refusal or a network error just leaves the Blob in place.
  void fetch("/api/delete-illustration", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  }).catch(() => {});
}
