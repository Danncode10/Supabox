/** Images are worked through in folders of SECTION_SIZE by image number: 1-50, 51-100, ... */
export const SECTION_SIZE = 50;

/** 0-based section for an image number (numbers start at 1 by default, but any start works). */
export function sectionOf(number: number): number {
  return Math.floor((Math.max(1, number) - 1) / SECTION_SIZE);
}

/** Inclusive number range covered by a section. */
export function sectionRange(section: number): { from: number; to: number } {
  return { from: section * SECTION_SIZE + 1, to: (section + 1) * SECTION_SIZE };
}

export type SectionGroup<T> = { section: number; from: number; to: number; items: T[] };

/** Groups items (already sorted by number) into consecutive sections; empty sections are skipped. */
export function groupBySection<T extends { number: number }>(items: T[]): SectionGroup<T>[] {
  const out: SectionGroup<T>[] = [];
  for (const it of items) {
    const s = sectionOf(it.number);
    let g = out[out.length - 1];
    if (!g || g.section !== s) {
      g = { section: s, ...sectionRange(s), items: [] };
      out.push(g);
    }
    g.items.push(it);
  }
  return out;
}
