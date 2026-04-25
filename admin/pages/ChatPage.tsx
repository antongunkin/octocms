import React from 'react';
import { notFound } from 'next/navigation';

import { ChatPage as ChatPageClient } from '../../components/Chat/ChatPage';
import { getAgentConfig } from '../../agent/configStore';
import { isAgentEnabled } from '../../agent/featureFlag';

/**
 * Server component wrapper for the chat page.
 *
 * Returns 404 (instead of rendering) when the chat agent isn't configured for
 * this deploy. The same gate is applied on the API route, so neither the UI
 * nor its data layer leak the feature's existence.
 */
export function ChatPage() {
  const agentConfig = getAgentConfig();
  if (!agentConfig || !isAgentEnabled(agentConfig)) {
    notFound();
  }
  return (
    <ChatPageClient
      initialMeta={{ provider: agentConfig.provider.type, model: agentConfig.provider.model }}
      attachmentLimits={{
        maxAttachmentBytes: agentConfig.maxAttachmentBytes,
        maxAttachmentsPerTurn: agentConfig.maxAttachmentsPerTurn,
      }}
    />
  );
}
