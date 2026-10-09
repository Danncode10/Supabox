/** Thumbnails sit beside their image: "<dataset>/thumbs/<name>.jpg" for "<dataset>/<name>.<ext>". */
export const THUMB_SIDE = 320;

export function thumbPathOf(storagePath: string): string {
  const slash = storagePath.lastIndexOf("/");
  const dir = storagePath.slice(0, slash);
  const stem = storagePath.slice(slash + 1).replace(/\.[^.]+$/, "");
  return `${dir}/thumbs/${stem}.jpg`;
}
