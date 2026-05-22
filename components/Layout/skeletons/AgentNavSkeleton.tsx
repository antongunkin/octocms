import React from 'react';

/**
 * Width-preserving placeholder for the Chat nav link slot. Renders an
 * invisible div the size of the real "Chat" link so the surrounding nav
 * doesn't reflow when `useAgentStatus` resolves and decides whether to
 * show the link. No shimmer — the user shouldn't be drawn to the slot;
 * we just want layout stability.
 */
export function AgentNavSkeleton() {
  return <div aria-hidden="true" className="octo-top-header__chat-nav-skel" />;
}
