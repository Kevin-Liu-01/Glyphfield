import { execFileSync } from 'node:child_process';
import path from 'node:path';

/**
 * Last-change dates for files under one directory, read from git history at build time.
 *
 * Vercel and most CI systems clone shallowly. Git treats the oldest fetched commit of a
 * shallow clone as a root commit and reports every file in it as changed on that date, so a
 * page last edited months ago would claim the date of a recent unrelated commit. Running
 * `git log` with `log.showRoot=false` hides that boundary commit: files whose newest change is
 * inside the fetched history get their real date, and every other file gets no date. Callers
 * must treat a missing date as unknown and omit it. Without git (for example in a serverless
 * runtime) every lookup returns undefined.
 */

const GIT_LOG_TIMEOUT_MS = 10_000;
const COMMIT_PREFIX = 'commit:';

const cache = new Map<string, ReadonlyMap<string, Date>>();

/** Parses `git log --format=commit:%cI --name-only` output into the newest date per path. */
export function parseGitLogDates(output: string): Map<string, Date> {
  const dates = new Map<string, Date>();
  let commitDate: Date | undefined;

  for (const line of output.split('\n')) {
    if (line.startsWith(COMMIT_PREFIX)) {
      const parsed = new Date(line.slice(COMMIT_PREFIX.length));
      commitDate = Number.isNaN(parsed.getTime()) ? undefined : parsed;
    } else if (line.length > 0 && commitDate && !dates.has(line)) {
      dates.set(line, commitDate);
    }
  }

  return dates;
}

export const GIT_LOG_ARGUMENTS = [
  '-c',
  'core.quotepath=off',
  '-c',
  'log.showRoot=false',
  'log',
  '--relative',
  `--format=${COMMIT_PREFIX}%cI`,
  '--name-only',
  '--',
] as const;

function readDirectoryDates(directory: string): ReadonlyMap<string, Date> {
  try {
    const output = execFileSync('git', [...GIT_LOG_ARGUMENTS, directory], {
      cwd: process.cwd(),
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: GIT_LOG_TIMEOUT_MS,
    });
    return parseGitLogDates(output);
  } catch {
    return new Map();
  }
}

function toRepositoryPath(filePath: string) {
  return path.relative(process.cwd(), path.resolve(process.cwd(), filePath)).split(path.sep).join('/');
}

/**
 * Date of the newest commit that changed `filePath`, or undefined when git history does not
 * prove it. `filePath` may be absolute or relative to the working directory.
 */
export function gitLastModified(filePath: string, directory = path.dirname(filePath)): Date | undefined {
  const key = toRepositoryPath(directory);
  let dates = cache.get(key);
  if (!dates) {
    dates = readDirectoryDates(key);
    cache.set(key, dates);
  }
  return dates.get(toRepositoryPath(filePath));
}
