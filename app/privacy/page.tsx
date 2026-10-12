import type { Metadata } from "next";
import Link from "next/link";
import { fredoka, nunito } from "@/lib/fonts";
import { Wordmark } from "@/components/Wordmark";

/* Privacy (#92, Step 9). A static server component like the landing page, and reachable from it,
   Settings and the sign-in screens, so it works for someone who hasn't signed in.

   Every claim here is checked against the code it describes (2026-10-11). When what we store or who
   processes it changes - a new vendor, a new column, a new cookie - update this page in the same PR.
   Plain language on purpose. Not legal advice: have a lawyer read it before Storykins charges money. */

export const metadata: Metadata = {
  title: "Privacy · Storykins",
  description: "What Storykins stores, who helps us run it, and how to delete everything.",
};

const UPDATED = "October 11, 2026";

export default function PrivacyPage() {
  return (
    <div className={`sk-lp sk-priv ${fredoka.variable} ${nunito.variable}`}>
      <header className="sk-lp-nav">
        <Link href="/" aria-label="Storykins home">
          <Wordmark className="sk-lp-word" />
        </Link>
        <a className="sk-lp-navbtn" href="/create">
          Open the app
        </a>
      </header>

      <main className="sk-priv-main">
        <h1>Privacy</h1>
        <p className="sk-priv-updated">Last updated {UPDATED}</p>

        <p className="sk-priv-lead">
          The short version: we keep as little as we can, we never sell it or show ads, and you can
          delete everything yourself from Settings.
        </p>

        <h2>Storykins is for grown-ups</h2>
        <p>
          Storykins is made for parents and caregivers to use with their kids. Accounts are for adults.
          We don&apos;t knowingly collect personal information from children. When you make up a hero, a
          nickname works just as well as your child&apos;s real name, and we suggest using one.
        </p>

        <h2>If you don&apos;t sign in</h2>
        <p>
          To write your story, the choices you make are sent to the AI companies listed below. After
          that, your current story is saved in your browser on this device only. We don&apos;t keep a
          copy, and clearing your browser data deletes it.
        </p>

        <h2>If you sign in</h2>
        <p>We store:</p>
        <ul>
          <li>Your email address, so we can send you sign-in links. There&apos;s no password.</li>
          <li>
            Your last 20 stories: the choices you made (world, hero, lesson and so on, including
            anything you typed), the story itself, its cover picture, and how far you&apos;ve read.
            When you make a 21st, the oldest one is deleted.
          </li>
        </ul>
        <p>
          Cover pictures are stored at a long, random web address that only your library knows about.
          Anyone given that exact address could open the picture, so think of it like an unlisted
          photo link.
        </p>

        <h2>Who helps us run Storykins</h2>
        <p>
          These companies process data for us to make the app work. None of them get it for their own
          marketing.
        </p>
        <ul>
          <li>
            <strong>Anthropic (Claude)</strong> writes the stories, from the choices you make.
          </li>
          <li>
            <strong>Google (Gemini)</strong> draws the cover pictures, from a short description of the
            story.
          </li>
          <li>
            <strong>Supabase</strong> stores accounts and saved stories.
          </li>
          <li>
            <strong>Vercel</strong> hosts the app and stores cover pictures. Its analytics count visits
            without using cookies.
          </li>
          <li>
            <strong>Brevo</strong> sends the sign-in emails.
          </li>
          <li>
            <strong>Upstash</strong> briefly holds IP addresses to stop anyone generating hundreds of
            stories a minute. Each one is forgotten within about a minute.
          </li>
        </ul>

        <h2>Cookies and browser storage</h2>
        <p>
          One cookie: the one that keeps you signed in. No advertising or tracking cookies. The app also
          keeps your current story and a few small settings (like whether the side menu is open) in your
          browser&apos;s own storage, on your device.
        </p>

        <h2>Deleting your data</h2>
        <ul>
          <li>
            <strong>One story:</strong> in your Library, tap ⋯ on the story and choose Delete story.
            Its cover picture is deleted with it.
          </li>
          <li>
            <strong>Everything:</strong> go to <a href="/settings">Settings</a> and choose Delete
            account. That deletes your account, every story, and every cover picture. It can&apos;t be
            undone.
          </li>
        </ul>
      </main>
    </div>
  );
}
