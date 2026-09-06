import { StoryDemo } from "./StoryDemo";

/* Hero for the landing page (#97, Direction C + Direction B's demo).

   Copy rule for this whole page: every claim has to be true of the *shipped* app. Supabase is
   absent from the stack list in BuildSection because it exists only on the accounts branch, not in
   what a visitor gets.

   "About twenty seconds" is deliberately hedged so a slow run doesn't make it false. It reflects
   Sarthak's own repeated use of the app; re-time a real generation if the model, prompt or story
   length changes, and adjust rather than letting it quietly drift. */

const TRUST = ["No account needed", "Free to use", "Works on any phone"];

export function LandingHero() {
  return (
    <section className="sk-lp-hero">
      <div className="sk-lp-hero-copy">
        <p className="sk-lp-eyebrow">Original stories, made to order</p>
        <h1 className="sk-lp-h1">
          An original bedtime story, written and illustrated in <em>about twenty seconds</em>.
        </h1>
        <p className="sk-lp-sub">
          Pick a world, a hero and the lesson you want it to land. Your kid picks what happens next —
          and no two stories come out the same.
        </p>

        <div className="sk-lp-cta-row">
          <a className="sk-lp-btn sk-lp-btn-primary" href="/create">
            Create a story — free
          </a>
          <a className="sk-lp-btn sk-lp-btn-ghost" href="#how-its-built">
            How it&rsquo;s built
          </a>
        </div>

        <ul className="sk-lp-trust">
          {TRUST.map((item) => (
            <li key={item}>
              <span className="sk-lp-dot" aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div className="sk-lp-hero-demo">
        <StoryDemo />
      </div>
    </section>
  );
}
