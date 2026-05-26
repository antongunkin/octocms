import React from 'react';
import dynamic from 'next/dynamic';

import { getAgentConfig } from '../../agent/configStore';
import { buildChatSetupInfo, isChatAgentReady } from '../../agent/chatSetup';

const ChatPageClient = dynamic(() => import('../../components/Chat/ChatPage'), {
  loading: () => null,
});

/**
 * Server component wrapper for the chat page.
 *
 * Always renders `/cms/chat`. When the agent is not ready, the client shows an
 * in-page setup guide (see `docs/chat-agent.md`). Chat API routes stay 404 until
 * `isAgentEnabled` passes — credentials are never sent to the browser.
 */
export function ChatPage() {
  const agentConfig = getAgentConfig();
  if (!isChatAgentReady(agentConfig)) {
    return <ChatPageClient mode="setup" setup={buildChatSetupInfo(agentConfig)} />;
  }
  return (
    <ChatPageClient
      mode="ready"
      initialMeta={{ provider: agentConfig!.provider.type, model: agentConfig!.provider.model }}
      attachmentLimits={{
        maxAttachmentBytes: agentConfig!.maxAttachmentBytes,
        maxAttachmentsPerTurn: agentConfig!.maxAttachmentsPerTurn,
      }}
    />
  );
}
