const REPO = "https://github.com/aio-studios/children-story-app";

/* Deliberately and visibly separated from everything above it: each item here is NOT built. The
   heading, the "not built yet" label and the muted styling all exist so a visitor can never mistake
   this for a feature list. Every entry links to its real tracking issue, which is both honest and
   the more interesting thing for a technical reader.

   Keep this short and keep it true. If something ships, move it up into the page proper and delete
   the row - a roadmap that still lists shipped features is worse than no roadmap. */

const PLANNED = [
  {
    title: "Accounts & a story library",
    body: "Sign in and keep every story you make, instead of just the last one.",
    issue: "23",
    status: "In progress",
  },
  {
    title: "Favourites & sharing",
    body: "Keep the ones that worked, and send a story to the other parent.",
    issue: "56",
    status: "Planned",
  },
  {
    title: "Read it aloud",
    body: "Narration, so a story works when nobody has a free hand.",
    issue: "26",
    status: "Planned",
  },
  {
    title: "Other languages",
    body: "Generate and read the same story in a family's own language.",
    issue: "70",
    status: "Planned",
  },
];

export function RoadmapStrip() {
  return (
    <section className="sk-lp-roadmap" aria-labelledby="sk-lp-roadmap-h">
      <div className="sk-lp-roadmap-head">
        <h2 className="sk-lp-h3" id="sk-lp-roadmap-h">
          Not built yet
        </h2>
        <p className="sk-lp-roadmap-note">
          Everything above this line works today. Everything below is still an open issue — listed
          here because the plan is public, not because it&rsquo;s finished.
        </p>
      </div>

      <ul className="sk-lp-roadmap-list">
        {PLANNED.map((item) => (
          <li key={item.issue} className="sk-lp-roadmap-item">
            <span className="sk-lp-roadmap-status">{item.status}</span>
            <h3 className="sk-lp-roadmap-title">{item.title}</h3>
            <p className="sk-lp-roadmap-body">{item.body}</p>
            <a
              className="sk-lp-roadmap-issue"
              href={`${REPO}/issues/${item.issue}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              #{item.issue}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
