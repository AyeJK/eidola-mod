// The rules the Eidola skill's scripts keep about where they write
// (scripts/engram-home.mjs, scripts/export-engram.mjs): which Engram home is
// used and why, that nothing is written inside Eidola's own folder, and that
// an export lands under the mod's test/ only as a fixture, asked for by name.
//
// Pure, as validate.ts is: paths come in as strings (absolute, symlinks
// already resolved by the caller), nothing is read, nothing from
// 'claude-code' is imported, so Node runs it as it is (type stripping) and
// hooks/home-rules.test.ts tests it in the kit.

/** Where the home came from, in the order they are asked. */
export type HomeSource = '--home' | 'EIDOLA_HOME' | 'EVAL_EIDOLA_HOME' | 'default'

/** What decides the home: the flag, the two variables, the default, and whether this is an eval's workspace. */
export type HomeAsk = {
  flag?: string
  eidolaHome?: string
  evalHome?: string
  /** ~/.claude/eidola, already joined. */
  defaultHome: string
  /** The folder holding an eval workspace's marker (.eidola-eval), when the working directory is inside one. */
  evalMarkerDir?: string
}

/** The home chosen: the path as given (the caller resolves it), where it came from, the folder a relative path is resolved from, or why none may be used. */
export type HomeChoice = { home: string; source: HomeSource; base?: string; refusal?: string; notice?: string }

/** The file an eval's scaffold writes at its workspace's top: the default home is refused under it. */
export const EVAL_MARKER = '.eidola-eval'

const given = (value: string | undefined): value is string => typeof value === 'string' && value.trim() !== ''

/**
 * Picks the home: --home, else EIDOLA_HOME, else EVAL_EIDOLA_HOME, else the
 * default, ~/.claude/eidola. Inside an eval's workspace the default is
 * refused (the eval's EVAL_EIDOLA_HOME didn't arrive, and the real home must
 * never be written by a test), and a relative path is read from the
 * workspace's top rather than wherever the shell happens to be. The default
 * is never taken silently: `notice` says so, for stderr.
 */
export function chooseHome(ask: HomeAsk): HomeChoice {
  const base = ask.evalMarkerDir
  if (given(ask.flag)) {
    return { home: ask.flag, source: '--home', base }
  }
  if (given(ask.eidolaHome)) {
    return { home: ask.eidolaHome, source: 'EIDOLA_HOME', base }
  }
  if (given(ask.evalHome)) {
    return { home: ask.evalHome, source: 'EVAL_EIDOLA_HOME', base }
  }
  if (ask.evalMarkerDir !== undefined) {
    return {
      home: ask.defaultHome,
      source: 'default',
      refusal: `This is an eval's workspace (${ask.evalMarkerDir} holds ${EVAL_MARKER}) and no home was given, so the default, ${ask.defaultHome}, would be the real one. Nothing was written. Set EVAL_EIDOLA_HOME (the eval case's execution.env), EIDOLA_HOME or --home.`,
    }
  }
  return { home: ask.defaultHome, source: 'default', notice: `eidola: using the default Engram home, ${ask.defaultHome} (no --home, EIDOLA_HOME or EVAL_EIDOLA_HOME given)` }
}

/** A path's parts, compared the way its file system does: Windows paths without regard to case or slash direction. */
function parts(path: string): string[] {
  const isWindows = /^[a-zA-Z]:[\\/]/.test(path) || path.startsWith('\\\\')
  const out = path.split(/[\\/]+/).filter(part => part !== '' && part !== '.')
  return isWindows ? out.map(part => part.toLowerCase()) : out
}

/** True when `child` is `parent` or inside it. Both absolute, with symlinks resolved. */
export function isInside(parent: string, child: string): boolean {
  const a = parts(parent)
  const b = parts(child)
  return a.length <= b.length && a.every((part, i) => part === b[i])
}

/** Why a home can't be used: it is inside Eidola's folder (both paths absolute, symlinks resolved). */
export function homeRefusal(eidolaRoot: string, home: string): string | undefined {
  return isInside(eidolaRoot, home) ? `${home} is inside Eidola's own folder (${eidolaRoot}). Your Engrams live outside it: leave --home and EIDOLA_HOME unset for ~/.claude/eidola, or name a folder of your own.` : undefined
}

/**
 * Why an export can't go to `target` (both absolute, symlinks resolved): it
 * is Eidola's folder or inside it. The one exception is the mod's own test/
 * folder, for a committed fixture, and only when `isFixture` (the exporter's
 * --fixture flag) says so; the Eidola skill never passes it.
 */
export function exportRefusal(eidolaRoot: string, target: string, isFixture: boolean): string | undefined {
  if (!isInside(eidolaRoot, target)) {
    return undefined
  }
  const rest = parts(target).slice(parts(eidolaRoot).length)
  if (rest[0] === 'test' && rest.length > 1) {
    return isFixture ? undefined : `${target} is inside the Eidola mod's test/ folder: a fixture is written there only with --fixture. Write the plugin to a folder of its own.`
  }
  return `${target} is inside the Eidola mod: write the plugin to a folder of its own.`
}
