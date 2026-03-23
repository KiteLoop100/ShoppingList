import { describe, expect, test } from "vitest";
import { getDummyCookAssistantReply } from "@/lib/recipe/cook-chat-dummy";

describe("getDummyCookAssistantReply", () => {
  test("returns placeholder until API is wired", async () => {
    await expect(getDummyCookAssistantReply()).resolves.toBe(
      "Diese Funktion wird in Kürze mit der KI verbunden.",
    );
  });
});
