import { Fredoka, Nunito } from "next/font/google";

// Shared across Home/Setup/Nav so they match StoryReader's storybook typography (docs/designs/day2-decided-direction.html).
export const fredoka = Fredoka({ subsets: ["latin"], weight: ["600"], variable: "--font-fredoka" });
export const nunito = Nunito({ subsets: ["latin"], weight: ["400", "700", "800"], variable: "--font-nunito" });
