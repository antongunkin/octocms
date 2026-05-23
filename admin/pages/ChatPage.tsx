import React from 'react';
import dynamic from 'next/dynamic';
import { notFound } from 'next/navigation';

import { getAgentConfig } from '../../agent/configStore';
import { isAgentEnabled } from '../../agent/featureFlag';

const ChatPageClient = dynamic(() => import('../../components/Chat/ChatPage'), {
  loading: () => null,
});

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
