/* The product wordmark, in one place.

   It used to be plain text styled per-context: all-brand in the sidebar, nav panel and reader bar,
   but two-tone (ink + brand) on the landing page - so the app and its own front door disagreed about
   what the logo looks like. Two-tone everywhere now; the caller supplies sizing/layout through
   `className`, this owns the colours. */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`sk-wordmark ${className}`.trim()}>
      Story<span>kins</span>
    </span>
  );
}
