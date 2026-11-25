/** The desk's sections. "Now" is the home page; every other one has its own address. */
export type Tab = "now" | "polls" | "blocs" | "count" | "vote" | "sources";
export type Section = Exclude<Tab, "now">;

/** Page titles for the section URLs ("/polls", "/blocs", …). */
export const SECTION_TITLES: Record<Section, string> = {
  polls: "Polls",
  blocs: "Blocs",
  count: "Count",
  vote: "Vote",
  sources: "Sources",
};

export function isSection(value: string): value is Section {
  return Object.prototype.hasOwnProperty.call(SECTION_TITLES, value);
}
