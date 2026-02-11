import { describe, expect, it } from 'vitest';
import type { AgentConfig } from '../config/types.js';
import { collectGroupBatchingConfig, resolveDebounceMs } from './group-batching-config.js';

describe('resolveDebounceMs', () => {
  it('prefers groupDebounceSec over deprecated groupPollIntervalMin', () => {
    expect(resolveDebounceMs({ groupDebounceSec: 2, groupPollIntervalMin: 9 })).toBe(2000);
  });

  it('falls back to default when no debounce config is provided', () => {
    expect(resolveDebounceMs({})).toBe(5000);
  });
});

describe('collectGroupBatchingConfig', () => {
  it('uses telegram-mtproto key for mtproto debounce settings', () => {
    const channels: AgentConfig['channels'] = {
      'telegram-mtproto': {
        enabled: true,
        apiId: 12345,
        groupDebounceSec: 1,
      },
    };

    const { intervals } = collectGroupBatchingConfig(channels);

    expect(intervals.get('telegram-mtproto')).toBe(1000);
    expect(intervals.has('telegram')).toBe(false);
  });

  it('prefixes mtproto instant groups with telegram-mtproto channel id', () => {
    const channels: AgentConfig['channels'] = {
      'telegram-mtproto': {
        enabled: true,
        apiId: 12345,
        instantGroups: ['-1001', '-1002'],
      },
    };

    const { instantIds } = collectGroupBatchingConfig(channels);

    expect(instantIds.has('telegram-mtproto:-1001')).toBe(true);
    expect(instantIds.has('telegram-mtproto:-1002')).toBe(true);
    expect(instantIds.has('telegram:-1001')).toBe(false);
  });
});
