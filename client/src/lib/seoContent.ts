// One copy of the shop-page and party-guide wording, shared with the server, which
// renders the same text into the HTML that search engines and AI assistants read.
// Edit server/src/content/seo-content.json, not this file.
import content from "../../../server/src/content/seo-content.json";

export type LocationCopy = (typeof content.locations)["bentley-heath"];

export const faq = content.faq;
export const officeFaq = content.officeFaq;
export const whyUs = content.whyUs;
export const family = content.family;
export type CategoryQA = { h: string; p: string; link?: string };
export const categoryQA = (slug: string): CategoryQA[] => (content.categoryQA as Record<string, CategoryQA[]>)[slug] ?? [];
export const partyGuide = content.partyGuide;
export const locationCopy = (slug: string): LocationCopy | undefined =>
  (content.locations as Record<string, LocationCopy>)[slug];
export const mapUrl = (q: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
