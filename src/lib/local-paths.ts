import "server-only";

/**
 * Absolute path inside the project folder, for files that only exist on the developer's machine
 * (.venv, models/). Joined at runtime on purpose: the bundler statically traces
 * path.join(process.cwd(), "...") and would try to bundle those folders (and fails on .venv symlinks).
 */
export function localPath(...parts: string[]): string {
  return [process.cwd(), ...parts].join("/");
}
