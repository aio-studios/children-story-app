import Anthropic from "@anthropic-ai/sdk";

export const HAIKU_MODEL = "claude-haiku-4-5";

export const anthropicClient = new Anthropic();

export function extractJsonBlock<T>(response: Anthropic.Message): T {
  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text content in Claude response");
  }
  return JSON.parse(textBlock.text) as T;
}
