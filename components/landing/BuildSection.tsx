const REPO = "https://github.com/aio-studios/children-story-app";

/* The half of the page aimed at whoever is deciding whether the person who built this can build.

   Everything here is checked against the code on the branch it ships from - the stack list is what
   `package.json` actually depends on, and each decision names the file it lives in so a reader can
   go and look. Nothing quotes a metric that would rot: no latency figures, no cost-per-story, no
   user counts. If a claim needs a number, it gets a link instead. */

const STACK = [
  "Next.js App Router",
  "TypeScript",
  "Tailwind CSS",
  "Claude Haiku 4.5",
  "Gemini 2.5 Flash Image",
  "Vercel AI SDK",
  "Upstash Redis",
  "Vercel Blob",
];

const DECISIONS = [
  {
    title: "Safety is a layer, not a prompt instruction",
    body:
      "Every request passes a local pattern filter first, then a Haiku classifier that catches the phrasing a word list misses. Model instructions were never treated as the control - they are guidance, not a boundary.",
    href: `${REPO}/blob/main/lib/contentSafety.ts`,
    file: "lib/contentSafety.ts",
  },
  {
    title: "Rate limiting has to be shared state",
    body:
      "Serverless functions don't share memory, so an in-process limiter protects nothing once traffic spreads across instances. It runs on a Redis sliding window instead, with a separate, looser budget for interactive story beats so normal tapping never trips the story-start limit.",
    href: `${REPO}/blob/main/lib/rateLimit.ts`,
    file: "lib/rateLimit.ts",
  },
  {
    title: "The expensive call is the user's to make",
    body:
      "Text generation costs a fraction of a cent; an illustrated cover costs meaningfully more. Cover art is a toggle the reader owns rather than a default, and when it fails the story still arrives - it degrades instead of breaking.",
    href: `${REPO}/blob/main/lib/imageClient.ts`,
    file: "lib/imageClient.ts",
  },
];

const LINKS = [
  { label: "Source on GitHub", href: REPO },
  { label: "Case studies", href: `${REPO}/tree/main/docs/case-studies` },
  { label: "Changelog", href: `${REPO}/blob/main/CHANGELOG.md` },
  { label: "Architecture", href: `${REPO}/blob/main/docs/architecture.md` },
];

export function BuildSection() {
  return (
    <section className="sk-lp-build" id="how-its-built">
      <div className="sk-lp-seam" aria-hidden="true">
        <span className="sk-lp-seam-line" />
        <span className="sk-lp-seam-label">Behind the build</span>
        <span className="sk-lp-seam-line" />
      </div>

      <div className="sk-lp-build-intro">
        <h2 className="sk-lp-h2">One person, product to production.</h2>
        <p className="sk-lp-sub">
          Storykins is a solo build — discovery, design, architecture and code. The interesting part
          isn&rsquo;t the stack, it&rsquo;s what had to be decided. Three of those decisions, and where they live:
        </p>
      </div>

      <ul className="sk-lp-stack" aria-label="Technologies used">
        {STACK.map((tech) => (
          <li key={tech} className="sk-lp-tech">
            {tech}
          </li>
        ))}
      </ul>

      <ol className="sk-lp-decisions">
        {DECISIONS.map((d) => (
          <li key={d.file} className="sk-lp-decision">
            <h3 className="sk-lp-decision-h">{d.title}</h3>
            <p className="sk-lp-decision-p">{d.body}</p>
            <a className="sk-lp-decision-file" href={d.href} target="_blank" rel="noopener noreferrer">
              {d.file}
            </a>
          </li>
        ))}
      </ol>

      <div className="sk-lp-links">
        {LINKS.map((link) => (
          <a
            key={link.href}
            className="sk-lp-link"
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
          >
            {link.label}
          </a>
        ))}
      </div>
    </section>
  );
}
