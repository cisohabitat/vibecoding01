import { describe, expect, it } from "vitest";
import { mentionsSingapore } from "../region";

describe("mentionsSingapore", () => {
  it("matches Singapore terms in the title or description", () => {
    expect(mentionsSingapore({ title: "Singapore bank hit by outage", description: "" })).toBe(true);
    expect(mentionsSingapore({ title: "Phishing wave", description: "Fake SingPass login pages" })).toBe(true);
    expect(mentionsSingapore({ title: "Singtel confirms breach", description: "" })).toBe(true);
  });

  it("doesn't match unrelated text", () => {
    expect(mentionsSingapore({ title: "MAS rules for SG banks", description: "" })).toBe(false);
    expect(mentionsSingapore({ title: "Ransomware hits hospital", description: "" })).toBe(false);
  });
});
