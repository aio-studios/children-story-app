import type { Metadata } from "next";
import { fredoka, nunito } from "@/lib/fonts";
import { AppScreenshot } from "@/components/landing/AppScreenshot";
import { BuildSection } from "@/components/landing/BuildSection";
import { InteractiveSection } from "@/components/landing/InteractiveSection";
import { LandingHero } from "@/components/landing/LandingHero";
import { RoadmapStrip } from "@/components/landing/RoadmapStrip";
import { Wordmark } from "@/components/Wordmark";

/* Landing page (#97). Static server component - the only client JS on this route is StoryDemo,
   reached through LandingHero. The app itself lives at /create.

   Design: docs/designs/landing-page-directions.html, Direction C ("The Dual Track") with Direction
   B's scripted demo in the hero. */

export const metadata: Metadata = {
  title: "Storykins — original bedtime stories for your kid",
  description:
    "Pick a world, a hero and a lesson, and Storykins writes and illustrates an original children's story. Your kid chooses what happens next. Free, no account needed.",
  openGraph: {
    title: "Storykins — original bedtime stories for your kid",
    description:
      "Pick a world, a hero and a lesson, and Storykins writes and illustrates an original children's story. Your kid chooses what happens next.",
    type: "website",
    siteName: "Storykins",
  },
  twitter: {
    card: "summary_large_image",
    title: "Storykins — original bedtime stories for your kid",
    description:
      "An original, illustrated children's story from whatever you pick. Free, no account needed.",
  },
};

export default function LandingPage() {
  return (
    <div className={`sk-lp ${fredoka.variable} ${nunito.variable}`}>
      <header className="sk-lp-nav">
        <Wordmark className="sk-lp-word" />
        <a className="sk-lp-navbtn" href="/create">
          Open app
        </a>
      </header>

      <main>
        <LandingHero />

        <section className="sk-lp-shots" aria-label="The app">
          <AppScreenshot
            slot="home"
            caption="Home"
            alt="The Storykins home screen: a greeting, illustrated genre cards for Adventure, Fantasy, Animals, Bedtime and Sci-fi, and shelves of stories below."
            priority
          />
          <AppScreenshot
            slot="setup-hero"
            caption="Choosing a hero"
            alt="The hero picker: a swipeable card carousel showing Prince Oren, a young prince who'd rather befriend a dragon than fight one."
          />
          <AppScreenshot
            slot="reader"
            caption="Reading it"
            alt="A finished story, “Prince Oren and the Dragon's Heart”, with a generated cover illustration of a young prince offering an apple to a friendly green dragon."
          />
        </section>

        <InteractiveSection />

        {/* Pinned to specific devices on purpose: the point of this section is showing the form
            factors the visitor is NOT on, so it can't follow the viewer's own shape like the row
            above does. */}
        <section className="sk-lp-devices" aria-labelledby="sk-lp-devices-h">
          <h2 className="sk-lp-h2" id="sk-lp-devices-h">
            Same story, whatever they&rsquo;re holding.
          </h2>
          <p className="sk-lp-sub">
            One codebase, three layouts — a bottom bar on a phone, a sidebar on an iPad or laptop, and
            a reading view that reflows for each.
          </p>
          <div className="sk-lp-device-row">
            <AppScreenshot
              pin="phone"
              slot="reader"
              caption="iPhone"
              alt="Storykins reading view on an iPhone: a generated cover illustration above the story text."
            />
            <AppScreenshot
              pin="ipad"
              slot="home"
              caption="iPad"
              alt="Storykins home screen on an iPad: a left sidebar beside illustrated genre cards and story shelves."
            />
          </div>
        </section>

        <BuildSection />

        <RoadmapStrip />

        <section className="sk-lp-close">
          <h2 className="sk-lp-h2">Make one tonight.</h2>
          <p className="sk-lp-sub">Nothing to install, nothing to sign up for.</p>
          <a className="sk-lp-btn sk-lp-btn-primary" href="/create">
            Create a story for free
          </a>
        </section>
      </main>

      <footer className="sk-lp-foot">
        <Wordmark className="sk-lp-word" />
        <p className="sk-lp-foot-note">
          Built by Sarthak Gupta ·{" "}
          <a href="https://github.com/aio-studios/children-story-app" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
        </p>
      </footer>
    </div>
  );
}
