import { getAgentStatus } from './featureFlag';
import type { AgentConfig, AgentProvider } from './types';

/** OctoCMS product documentation — linked from the in-admin setup screen. */
export const CHAT_AGENT_DOCS_HREF = 'https://octocms.gunkin.dev/docs/chat-agent';

export type ChatSetupReason = 'no-config' | 'no-key' | 'budget-exceeded';

export type ChatSetupStep = {
  title: string;
  detail: string;
  code?: string;
};

export type ChatSetupInfo = {
  reason: ChatSetupReason;
  docsHref: string;
  headline: string;
  summary: string;
  steps: ChatSetupStep[];
};

export function isChatAgentReady(agentConfig: AgentConfig | null | undefined): boolean {
  if (!agentConfig) return false;
  return getAgentStatus(agentConfig).enabled;
}

export function buildChatSetupInfo(agentConfig: AgentConfig | null | undefined): ChatSetupInfo {
  if (!agentConfig) {
    return {
      reason: 'no-config',
      docsHref: CHAT_AGENT_DOCS_HREF,
      headline: 'Chat agent is not configured',
      summary:
        'The chat agent is optional. Follow the OctoCMS documentation to install dependencies, add agent settings to your project config, and connect a model provider.',
      steps: noConfigSteps(),
    };
  }

  const status = getAgentStatus(agentConfig);
  if (status.enabled) {
    throw new Error('buildChatSetupInfo called while agent is enabled');
  }

  if (status.reason === 'budget-exceeded') {
    return {
      reason: 'budget-exceeded',
      docsHref: CHAT_AGENT_DOCS_HREF,
      headline: 'Chat agent budget reached',
      summary: `This deploy has reached the configured spend cap ($${status.budgetUSD.toFixed(2)}). Raise the limit in your agent config or restart the server to reset the in-memory counter.`,
      steps: budgetExceededSteps(),
    };
  }

  return {
    reason: 'no-key',
    docsHref: CHAT_AGENT_DOCS_HREF,
    headline: 'Chat agent is not ready',
    summary: providerCredentialSummary(agentConfig.provider),
    steps: noKeySteps(agentConfig.provider),
  };
}

function noConfigSteps(): ChatSetupStep[] {
  return [
    {
      title: 'Read the setup guide',
      detail:
        'The documentation covers supported providers, required packages, and a full checklist for your environment.',
    },
    {
      title: 'Add agent settings to your project',
      detail:
        'Export `agentConfig` from `cms/octocms.config.ts` using `defineAgentConfig`, alongside your main CMS config.',
    },
    {
      title: 'Connect your model provider',
      detail:
        'Configure the provider block (hosted API or local endpoint) and add the credentials or URL your deployment expects. Restart the app after changing secrets.',
    },
    {
      title: 'Index content for search (recommended)',
      detail: 'Run the embeddings command from the docs so the agent can retrieve entries from your repository.',
    },
  ];
}

function noKeySteps(provider: AgentProvider): ChatSetupStep[] {
  if (provider.type === 'local') {
    return [
      {
        title: 'Confirm the local endpoint',
        detail:
          'Ensure your OpenAI-compatible server is running and that `agentConfig` points at the correct base URL for this deployment.',
      },
      {
        title: 'Check optional auth',
        detail: 'If your server requires an API key, set the env var named in `provider.apiKeyEnv` and restart.',
      },
      {
        title: 'Restart after changes',
        detail: 'Restart the dev server or redeploy so new environment variables are loaded.',
      },
    ];
  }

  return [
    {
      title: 'Add provider credentials',
      detail:
        'Set the API key (or custom env var) described in the setup guide for your chosen hosted provider, in local env files and production secrets.',
    },
    {
      title: 'Restart or redeploy',
      detail: 'Restart the dev server locally. On hosted platforms, redeploy after updating secrets.',
    },
    {
      title: 'Install required packages',
      detail: 'Install the chat and embedding dependencies listed in the documentation before sending a message.',
    },
  ];
}

function budgetExceededSteps(): ChatSetupStep[] {
  return [
    {
      title: 'Raise the deploy cap',
      detail:
        'Increase `totalBudgetUSD` in `cms/octocms.config.ts`, or set it to `0` to disable the cap for this deploy.',
    },
    {
      title: 'Or reset the in-memory counter',
      detail: 'The spend tracker resets on cold start — redeploy or restart the dev server during testing.',
    },
    {
      title: 'Use provider-side alerts',
      detail: 'For production, also configure spend alerts in your model provider’s dashboard.',
    },
  ];
}

function providerCredentialSummary(provider: AgentProvider): string {
  if (provider.type === 'local') {
    return provider.baseURL
      ? 'A local provider is configured, but the server could not reach the endpoint. Confirm the model server is running and accessible from this app.'
      : 'A local provider needs an endpoint URL in `agentConfig`. See the setup guide for examples.';
  }
  const label = provider.type === 'anthropic' ? 'Anthropic' : 'OpenAI';
  return `${label} is selected in config, but the required credentials are missing or empty. Follow the setup guide to add them and restart.`;
}
