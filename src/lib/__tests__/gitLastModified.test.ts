import { beforeEach, describe, expect, it, vi } from 'vitest';

const execFileSync = vi.hoisted(() => vi.fn());
vi.mock('node:child_process', () => ({ execFileSync }));

import { GIT_LOG_ARGUMENTS, gitLastModified, parseGitLogDates } from '../gitLastModified';

describe('parseGitLogDates', () => {
  it('keeps the newest commit date for each path', () => {
    const dates = parseGitLogDates([
      'commit:2026-10-14T10:00:00-07:00',
      '',
      'content/docs/a.mdx',
      'commit:2026-09-11T09:54:16-07:00',
      '',
      'content/docs/a.mdx',
      'content/docs/b.mdx',
    ].join('\n'));

    expect(dates.get('content/docs/a.mdx')?.toISOString()).toBe('2026-10-14T17:00:00.000Z');
    expect(dates.get('content/docs/b.mdx')?.toISOString()).toBe('2026-09-11T16:54:16.000Z');
  });

  it('ignores paths listed under an unreadable commit date', () => {
    const dates = parseGitLogDates('commit:not-a-date\ncontent/docs/a.mdx\n');
    expect(dates.size).toBe(0);
  });
});

describe('gitLastModified', () => {
  beforeEach(() => {
    execFileSync.mockReset();
  });

  it('hides the shallow-clone boundary commit so it cannot date unrelated files', () => {
    execFileSync.mockReturnValue('commit:2026-09-11T16:54:16Z\n\ncontent/guides/connect.mdx\n');

    expect(gitLastModified('content/guides/connect.mdx', 'content/guides')?.toISOString())
      .toBe('2026-09-11T16:54:16.000Z');
    expect(gitLastModified('content/guides/untouched.mdx', 'content/guides')).toBeUndefined();
    expect(execFileSync).toHaveBeenCalledTimes(1);
    expect(execFileSync.mock.calls[0]?.[1]).toEqual([...GIT_LOG_ARGUMENTS, 'content/guides']);
    expect(GIT_LOG_ARGUMENTS).toContain('log.showRoot=false');
  });

  it('accepts absolute paths', () => {
    execFileSync.mockReturnValue('commit:2026-09-11T16:54:16Z\n\ncontent/absolute/page.mdx\n');

    expect(gitLastModified(`${process.cwd()}/content/absolute/page.mdx`, 'content/absolute')).toBeInstanceOf(Date);
  });

  it('returns undefined when git is unavailable', () => {
    execFileSync.mockImplementation(() => {
      throw new Error('spawn git ENOENT');
    });

    expect(gitLastModified('content/missing/page.mdx', 'content/missing')).toBeUndefined();
  });
});
