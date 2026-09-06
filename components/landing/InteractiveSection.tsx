import { AppScreenshot } from "./AppScreenshot";

/* Interactive mode (#37) is the most capable thing the app does and it was getting a single line on
   the landing page. This section gives it real estate.

   Everything here describes shipped behaviour: the story pauses at each beat, offers three generated
   directions plus a free-text option, and every pick runs the same safety layer as the initial
   prompt. Nothing on this page describes anything unbuilt - that lives in RoadmapStrip, clearly
   labelled. */

const BEATS = [
  {
    title: "The story stops and asks",
    body: "Each beat ends on a decision instead of a full stop. Nothing advances until your kid chooses.",
  },
  {
    title: "Three directions, or their own",
    body: "Pick one of three generated options, or type something the story has never heard of. Free text runs the same safety checks as everything else.",
  },
  {
    title: "It knows how to end",
    body: "The chosen length sets a beat range, and the storyteller is steered toward a real ending rather than running until someone gives up.",
  },
];

export function InteractiveSection() {
  return (
    <section className="sk-lp-interactive" aria-labelledby="sk-lp-interactive-h">
      <div className="sk-lp-interactive-copy">
        <p className="sk-lp-eyebrow">Interactive mode</p>
        <h2 className="sk-lp-h2" id="sk-lp-interactive-h">
          They decide what happens next.
        </h2>
        <p className="sk-lp-sub">
          Switch it on and the story becomes a conversation. The same setup never plays out the same
          way twice — because the plot is theirs, not the model&rsquo;s.
        </p>
        <ol className="sk-lp-beats">
          {BEATS.map((beat) => (
            <li key={beat.title} className="sk-lp-beat">
              <h3 className="sk-lp-beat-h">{beat.title}</h3>
              <p className="sk-lp-beat-p">{beat.body}</p>
            </li>
          ))}
        </ol>
      </div>

      <div className="sk-lp-interactive-shot">
        <AppScreenshot
          pin="phone"
          slot="interactive"
          caption="Steering the story"
          alt="An interactive story mid-flow: a Continue button, a Choose button, and three suggested directions — the door glows and creaks open, a small voice asks who is there, a golden key falls from the sky — plus a “Write your own” option."
        />
      </div>
    </section>
  );
}
