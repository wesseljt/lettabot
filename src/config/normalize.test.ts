import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { normalizeAgents, type LettaBotConfig, type AgentConfig } from './types.js';

describe('normalizeAgents', () => {
  it('should normalize legacy single-agent config to one-entry array', () => {
    const config: LettaBotConfig = {
      server: { mode: 'cloud' },
      agent: {
        name: 'TestBot',
        model: 'anthropic/claude-sonnet-4',
      },
      channels: {
        telegram: {
          enabled: true,
          token: 'test-token',
        },
      },
    };

    const agents = normalizeAgents(config);

    expect(agents).toHaveLength(1);
    expect(agents[0].name).toBe('TestBot');
    expect(agents[0].model).toBe('anthropic/claude-sonnet-4');
    expect(agents[0].channels.telegram?.token).toBe('test-token');
  });

  it('should drop channels with enabled: false', () => {
    const config: LettaBotConfig = {
      server: { mode: 'cloud' },
      agent: { name: 'TestBot', model: 'test' },
      channels: {
        telegram: {
          enabled: true,
          token: 'test-token',
        },
        slack: {
          enabled: false,
          botToken: 'should-be-dropped',
        },
      },
    };

    const agents = normalizeAgents(config);

    expect(agents[0].channels.telegram).toBeDefined();
    expect(agents[0].channels.slack).toBeUndefined();
  });

  it('should normalize multi-agent config channels', () => {
    const agentsArray: AgentConfig[] = [
      {
        name: 'Bot1',
        channels: {
          telegram: { enabled: true, token: 'token1' },
          slack: { enabled: true, botToken: 'missing-app-token' },
        },
      },
      {
        name: 'Bot2',
        channels: {
          slack: { enabled: true, botToken: 'token2', appToken: 'app2' },
          discord: { enabled: false, token: 'disabled' },
        },
      },
    ];

    const config: LettaBotConfig = {
      server: { mode: 'cloud' },
      agents: agentsArray,
      // Legacy fields (ignored when agents[] is present)
      agent: { name: 'Unused', model: 'unused' },
      channels: {},
    };

    const agents = normalizeAgents(config);

    expect(agents).toHaveLength(2);
    expect(agents[0].channels.telegram?.token).toBe('token1');
    expect(agents[0].channels.slack).toBeUndefined();
    expect(agents[1].channels.slack?.botToken).toBe('token2');
    expect(agents[1].channels.discord).toBeUndefined();
  });

  it('should produce empty channels object when no channels configured', () => {
    const config: LettaBotConfig = {
      server: { mode: 'cloud' },
      agent: { name: 'TestBot', model: 'test' },
      channels: {},
    };

    const agents = normalizeAgents(config);

    expect(agents[0].channels).toEqual({});
  });

  it('should default agent name to "LettaBot" when not provided', () => {
    const config: LettaBotConfig = {
      server: { mode: 'cloud' },
      agent: { name: '', model: '' }, // Empty name should fall back to 'LettaBot'
      channels: {},
    };

    // Override with empty name to test default
    const agents = normalizeAgents({
      ...config,
      agent: undefined as any, // Test fallback when agent is missing
    });

    expect(agents[0].name).toBe('LettaBot');
  });

  it('should drop channels without required credentials', () => {
    const config: LettaBotConfig = {
      server: { mode: 'cloud' },
      agent: { name: 'TestBot', model: 'test' },
      channels: {
        telegram: {
          enabled: true,
          // Missing token
        },
        slack: {
          enabled: true,
          botToken: 'has-bot-token-only',
          // Missing appToken
        },
        signal: {
          enabled: true,
          // Missing phone
        },
        discord: {
          enabled: true,
          // Missing token
        },
      },
    };

    const agents = normalizeAgents(config);

    expect(agents[0].channels).toEqual({});
  });

  it('should preserve agent id when provided', () => {
    const config: LettaBotConfig = {
      server: { mode: 'cloud' },
      agent: {
        id: 'agent-123',
        name: 'TestBot',
        model: 'test',
      },
      channels: {},
    };

    const agents = normalizeAgents(config);

    expect(agents[0].id).toBe('agent-123');
  });

  describe('env var fallback (container deploys)', () => {
    const envVars = [
      'TELEGRAM_BOT_TOKEN', 'TELEGRAM_DM_POLICY',
      'SLACK_BOT_TOKEN', 'SLACK_APP_TOKEN', 'SLACK_DM_POLICY',
      'WHATSAPP_ENABLED', 'WHATSAPP_SELF_CHAT_MODE', 'WHATSAPP_DM_POLICY',
      'SIGNAL_PHONE_NUMBER', 'SIGNAL_SELF_CHAT_MODE', 'SIGNAL_DM_POLICY',
      'DISCORD_BOT_TOKEN', 'DISCORD_DM_POLICY',
    ];
    const savedEnv: Record<string, string | undefined> = {};

    beforeEach(() => {
      for (const key of envVars) {
        savedEnv[key] = process.env[key];
        delete process.env[key];
      }
    });

    afterEach(() => {
      for (const key of envVars) {
        if (savedEnv[key] !== undefined) {
          process.env[key] = savedEnv[key];
        } else {
          delete process.env[key];
        }
      }
    });

    it('should pick up channels from env vars when YAML has none', () => {
      process.env.TELEGRAM_BOT_TOKEN = 'env-telegram-token';
      process.env.DISCORD_BOT_TOKEN = 'env-discord-token';

      const config: LettaBotConfig = {
        server: { mode: 'cloud' },
        agent: { name: 'TestBot', model: 'test' },
        channels: {},
      };

      const agents = normalizeAgents(config);

      expect(agents[0].channels.telegram?.token).toBe('env-telegram-token');
      expect(agents[0].channels.discord?.token).toBe('env-discord-token');
    });

    it('should not override YAML channels with env vars', () => {
      process.env.TELEGRAM_BOT_TOKEN = 'env-token';

      const config: LettaBotConfig = {
        server: { mode: 'cloud' },
        agent: { name: 'TestBot', model: 'test' },
        channels: {
          telegram: { enabled: true, token: 'yaml-token' },
        },
      };

      const agents = normalizeAgents(config);

      expect(agents[0].channels.telegram?.token).toBe('yaml-token');
    });

    it('should not apply env vars in multi-agent mode', () => {
      process.env.TELEGRAM_BOT_TOKEN = 'env-token';

      const config: LettaBotConfig = {
        server: { mode: 'cloud' },
        agents: [{ name: 'Bot1', channels: {} }],
        agent: { name: 'Unused', model: 'unused' },
        channels: {},
      };

      const agents = normalizeAgents(config);

      expect(agents[0].channels.telegram).toBeUndefined();
    });

    it('should pick up all channel types from env vars', () => {
      process.env.TELEGRAM_BOT_TOKEN = 'tg-token';
      process.env.SLACK_BOT_TOKEN = 'slack-bot';
      process.env.SLACK_APP_TOKEN = 'slack-app';
      process.env.WHATSAPP_ENABLED = 'true';
      process.env.SIGNAL_PHONE_NUMBER = '+1234567890';
      process.env.DISCORD_BOT_TOKEN = 'discord-token';

      const config: LettaBotConfig = {
        server: { mode: 'cloud' },
        agent: { name: 'TestBot', model: 'test' },
        channels: {},
      };

      const agents = normalizeAgents(config);

      expect(agents[0].channels.telegram?.token).toBe('tg-token');
      expect(agents[0].channels.slack?.botToken).toBe('slack-bot');
      expect(agents[0].channels.slack?.appToken).toBe('slack-app');
      expect(agents[0].channels.whatsapp?.enabled).toBe(true);
      expect(agents[0].channels.signal?.phone).toBe('+1234567890');
      expect(agents[0].channels.discord?.token).toBe('discord-token');
    });
  });

  it('should preserve features, polling, and integrations', () => {
    const config: LettaBotConfig = {
      server: { mode: 'cloud' },
      agent: { name: 'TestBot', model: 'test' },
      channels: {},
      features: {
        cron: true,
        heartbeat: {
          enabled: true,
          intervalMin: 10,
        },
        maxToolCalls: 50,
      },
      polling: {
        enabled: true,
        intervalMs: 30000,
      },
      integrations: {
        google: {
          enabled: true,
          account: 'test@example.com',
        },
      },
    };

    const agents = normalizeAgents(config);

    expect(agents[0].features).toEqual(config.features);
    expect(agents[0].polling).toEqual(config.polling);
    expect(agents[0].integrations).toEqual(config.integrations);
  });
});
