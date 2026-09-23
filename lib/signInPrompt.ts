import { ContinueStory, getContinueProgress, getContinueTimeSpent } from "./storyHistory";

// When the end-of-story sign-in sheet is allowed to appear (#92, Step 7).
//
// WHAT COUNTS AS FINISHED. Deliberately NOT the Continue card's rule (isContinueComplete), even
// though the two look like the same question. That rule is tuned to fail safe in the opposite
// direction: being too strict there just means Home keeps offering to resume a story, which is
// harmless. Being too strict HERE means never asking at all. Reusing it (2 min for a "quick" story,
// 10 for a "longer" one) made the sheet effectively unreachable in real use - a quick story reads
// aloud in 60-90 seconds, and the reader's clock pauses whenever the tab is hidden, so a parent who
// puts the phone down mid-story banks nothing. Caught in UAT 2026-09-23.
//
// So: reaching the end is the signal, and the 30s floor exists only to exclude a scroll-slam -
// someone who flicked to the bottom in four seconds has not finished anything.
const SCROLL_END = 0.98;
const MIN_READ_MS = 30_000;

export function isStoryFinished(progress: number, timeSpentMs: number): boolean {
  return progress >= SCROLL_END && timeSpentMs >= MIN_READ_MS;
}

// The same question asked of a story that is arriving on screen rather than being read. Opening an
// already-finished story is not the moment to ask, so the caller uses this to burn its one-ask guard.
export function slotArrivesFinished(slot: ContinueStory): boolean {
  if (slot.mode === "interactive") return slot.interactive.ended;
  return isStoryFinished(getContinueProgress(slot), getContinueTimeSpent(slot));
}

//
// The design doc's own critique of direction A was "one ask, one chance" - dismiss the sheet and
// there is nothing left reminding you that stories aren't saved. The opposite (asking at the end of
// every story) is worse: that is how you teach someone to stop finishing stories. So a dismissal
// snoozes the ask for a week. Long enough that the next one reads as a fresh thought rather than
// nagging, short enough that a parent who is now on their sixth story gets a second chance. The
// standing "Saved on this phone only" line in the Library carries the honesty in between.
const SNOOZE_KEY = "storykins:signin-snoozed-until";
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

export function isSignInAskSnoozed(): boolean {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(SNOOZE_KEY);
  } catch {
    // Storage blocked (private mode / lockdown). Nothing was ever persisted, so nothing is snoozed -
    // and the sheet's own once-per-story guard still stops it repeating within a session.
    return false;
  }
  if (!raw) return false;
  const until = Number(raw);
  // Garbled value: treat as "never asked" rather than letting an unparseable string mute the ask
  // forever. Same answer for a stamp further out than the window itself, which can only come from a
  // clock that has since moved backwards (travel, a device set wrong) - expire it instead of
  // silencing the sheet for years.
  const now = Date.now();
  if (!Number.isFinite(until) || until > now + SNOOZE_MS) return false;
  return now < until;
}

export function snoozeSignInAsk(): void {
  try {
    window.localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
  } catch {
    /* storage blocked - this session's in-memory guard still holds; the next one asks again */
  }
}
