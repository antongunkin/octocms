'use client';

import React from 'react';

import { relativeTime } from '../../lib/relativeTime';
import { Icon } from '../ui';

import type { ChatSessionListItem } from './chatStorage';

type Props = {
  sessions: ChatSessionListItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
};

export function ChatSidebar({ sessions, activeId, onSelect, onDelete }: Props) {
  return (
    <div className="octo-page-sidebar__section">
      <span className="octo-page-sidebar__section-label">Conversations</span>
      <nav className="octo-page-sidebar__nav" aria-label="Saved conversations">
        {sessions.length === 0 ? (
          <p className="octo-chat-session__empty">No saved chats yet. Send a message to save one here.</p>
        ) : (
          sessions.map((session) => {
            const active = session.id === activeId;
            return (
              <div key={session.id} className="octo-chat-session">
                <button
                  type="button"
                  className="octo-chat-session__button"
                  onClick={() => onSelect(session.id)}
                  aria-current={active ? 'true' : undefined}
                >
                  <span className="octo-chat-session__title">{session.title}</span>
                  <span className="octo-chat-session__time">
                    {relativeTime(new Date(session.updatedAt).toISOString())}
                  </span>
                </button>
                <button
                  type="button"
                  className="octo-chat-session__delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`Delete "${session.title}"?`)) onDelete(session.id);
                  }}
                  aria-label={`Delete ${session.title}`}
                >
                  <Icon.Trash2 className="octo-icon-xs" />
                </button>
              </div>
            );
          })
        )}
      </nav>
    </div>
  );
}
