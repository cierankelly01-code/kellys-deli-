// The sender line customers actually see. An unquoted display name containing an
// apostrophe ("Kelly's Deli") arrived mangled in a real inbox — quoting fixes it,
// and doing it in code means a hand-edited EMAIL_FROM can't reintroduce the bug.
import { describe, it, expect } from "vitest";
import { normaliseFrom } from "../src/lib/notify";

describe("normaliseFrom", () => {
  it("quotes a display name containing an apostrophe", () => {
    expect(normaliseFrom("Kelly's Deli <hello@kellysdeli.co.uk>"))
      .toBe('"Kelly\'s Deli" <hello@kellysdeli.co.uk>');
  });

  it("leaves an already-quoted name alone", () => {
    expect(normaliseFrom('"Kelly\'s Deli" <hello@kellysdeli.co.uk>'))
      .toBe('"Kelly\'s Deli" <hello@kellysdeli.co.uk>');
  });

  it("passes a bare address straight through", () => {
    expect(normaliseFrom("hello@kellysdeli.co.uk")).toBe("hello@kellysdeli.co.uk");
  });

  it("tolerates stray whitespace", () => {
    expect(normaliseFrom("  Kelly's Deli   <hello@kellysdeli.co.uk>  "))
      .toBe('"Kelly\'s Deli" <hello@kellysdeli.co.uk>');
  });

  it("escapes quotes and backslashes inside the name", () => {
    expect(normaliseFrom('Kelly "The Deli" <hello@kellysdeli.co.uk>'))
      .toBe('"Kelly \\"The Deli\\"" <hello@kellysdeli.co.uk>');
  });

  it("falls back to the address when the name is empty", () => {
    expect(normaliseFrom("  <hello@kellysdeli.co.uk>")).toBe("hello@kellysdeli.co.uk");
  });
});
