/* Serves the screenshot that matches the shape the visitor is actually on (#97).

   The app renders three shapes (lib/useLayoutMode.ts): a laptop and an iPad both get the sidebar
   `sk-shell-tablet` layout, a phone gets `sk-shell-portrait`. Showing a phone screenshot to someone
   on a laptop is the exact mismatch that makes a landing page look thrown together, so each shape
   gets captures taken at that shape - laptop and iPad are split further because their aspect ratios
   are nothing alike, even though the app treats them the same.

   Light/dark is handled the same way. The app has no theme toggle; it follows the OS, so the
   screenshots do too. Every source carries width/height so the slot reserves its space before the
   image decodes (no layout shift). */

/* `min-height: 600px` is not decoration - it is the half of lib/useLayoutMode.ts's TABLET_QUERY that
   is easy to drop. Without it a landscape phone (844x390) matches `min-width: 768px` and gets served
   iPad screenshots, which is precisely the landing/app disagreement this component exists to avoid.
   Caught by QA at a 844x390 viewport. Short viewports fall through to the phone captures. */
const TALL_ENOUGH = "(min-height: 600px)";

const DEVICES = {
  laptop: { width: 1600, height: 1000, media: `(min-width: 1200px) and ${TALL_ENOUGH}` },
  ipad: { width: 698, height: 1000, media: `(min-width: 768px) and ${TALL_ENOUGH}` },
  phone: { width: 360, height: 780, media: null },
} as const;

export type ScreenshotSlot = "home" | "setup-hero" | "reader" | "interactive";
export type Device = keyof typeof DEVICES;

type AppScreenshotProps = {
  slot: ScreenshotSlot;
  /** Describe what the screenshot shows - it carries real meaning on this page. */
  alt: string;
  caption: string;
  priority?: boolean;
  /** Pin to one device instead of following the viewer's shape - used by the device showcase,
   *  where the whole point is showing a form factor the visitor is NOT currently on. */
  pin?: Device;
};

export function AppScreenshot({ slot, alt, caption, priority = false, pin }: AppScreenshotProps) {
  const fallback = DEVICES[pin ?? "phone"];
  const fallbackKey = pin ?? "phone";
  // A pinned shot needs no width-based sources; only the dark-scheme swap.
  const shapes = pin ? [] : (["laptop", "ipad"] as const);

  return (
    <figure className={`sk-lp-shot ${pin ? `sk-lp-shot-${pin}` : ""}`.trim()}>
      <picture>
        {shapes.flatMap((key) => [
          <source
            key={`${key}-dark`}
            media={`${DEVICES[key].media} and (prefers-color-scheme: dark)`}
            srcSet={`/landing/${key}-${slot}-dark.jpg`}
            width={DEVICES[key].width}
            height={DEVICES[key].height}
          />,
          <source
            key={key}
            media={DEVICES[key].media as string}
            srcSet={`/landing/${key}-${slot}-light.jpg`}
            width={DEVICES[key].width}
            height={DEVICES[key].height}
          />,
        ])}
        <source
          media="(prefers-color-scheme: dark)"
          srcSet={`/landing/${fallbackKey}-${slot}-dark.jpg`}
          width={fallback.width}
          height={fallback.height}
        />
        {/* Plain <img> inside <picture>, not next/image: these are pre-sized static /public assets
            and skipping the optimizer keeps Vercel image-transform usage at zero. Matches the
            existing pattern in HomeScreen/SetupDeck. */}
        <img
          className="sk-lp-shot-img"
          src={`/landing/${fallbackKey}-${slot}-light.jpg`}
          alt={alt}
          width={fallback.width}
          height={fallback.height}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
        />
      </picture>
      <figcaption className="sk-lp-shot-cap">{caption}</figcaption>
    </figure>
  );
}
