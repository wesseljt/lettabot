import type { AgentConfig } from '../config/types.js';

type DebounceConfig = { groupDebounceSec?: number; groupPollIntervalMin?: number };

/**
 * Resolve group debounce value to milliseconds.
 * Prefers groupDebounceSec, falls back to deprecated groupPollIntervalMin.
 * Default: 5 seconds (5000ms).
 */
export function resolveDebounceMs(channel: DebounceConfig): number {
  if (channel.groupDebounceSec !== undefined) return channel.groupDebounceSec * 1000;
  if (channel.groupPollIntervalMin !== undefined) return channel.groupPollIntervalMin * 60 * 1000;
  return 5000;
}

/**
 * Build per-channel group batching configuration for an agent.
 */
export function collectGroupBatchingConfig(
  channels: AgentConfig['channels'],
): { intervals: Map<string, number>; instantIds: Set<string> } {
  const intervals = new Map<string, number>();
  const instantIds = new Set<string>();

  if (channels.telegram) {
    intervals.set('telegram', resolveDebounceMs(channels.telegram));
    for (const id of channels.telegram.instantGroups || []) {
      instantIds.add(`telegram:${id}`);
    }
  }

  const mtprotoConfig = channels['telegram-mtproto'];
  if (mtprotoConfig) {
    intervals.set('telegram-mtproto', resolveDebounceMs(mtprotoConfig));
    for (const id of mtprotoConfig.instantGroups || []) {
      instantIds.add(`telegram-mtproto:${id}`);
    }
  }

  if (channels.slack) {
    intervals.set('slack', resolveDebounceMs(channels.slack));
    for (const id of channels.slack.instantGroups || []) {
      instantIds.add(`slack:${id}`);
    }
  }

  if (channels.whatsapp) {
    intervals.set('whatsapp', resolveDebounceMs(channels.whatsapp));
    for (const id of channels.whatsapp.instantGroups || []) {
      instantIds.add(`whatsapp:${id}`);
    }
  }

  if (channels.signal) {
    intervals.set('signal', resolveDebounceMs(channels.signal));
    for (const id of channels.signal.instantGroups || []) {
      instantIds.add(`signal:${id}`);
    }
  }

  if (channels.discord) {
    intervals.set('discord', resolveDebounceMs(channels.discord));
    for (const id of channels.discord.instantGroups || []) {
      instantIds.add(`discord:${id}`);
    }
  }

  return { intervals, instantIds };
}
