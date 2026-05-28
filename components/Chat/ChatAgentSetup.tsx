'use client';

import Link from 'next/link';
import React from 'react';

import type { ChatSetupInfo } from '../../agent/chatSetup';
import { Page } from '../Layout/Page';
import { Button, Icon } from '../ui';

type Props = {
  setup: ChatSetupInfo;
};

export function ChatAgentSetup({ setup }: Props) {
  return (
    <Page className="octo-chat-page" title="Chat" breadcrumbs={[{ label: 'Setup required' }]}>
      <div className="octo-chat-setup" data-testid="chat-agent-setup">
        <div className="octo-chat-setup__hero">
          <Icon.Bot className="octo-chat-setup__icon octo-icon-xl" aria-hidden />
          <h2 className="octo-chat-setup__headline">{setup.headline}</h2>
          <p className="octo-chat-setup__summary">{setup.summary}</p>
          <Button variant="primary" asChild>
            <Link href={setup.docsHref} target="_blank" rel="noopener noreferrer">
              Open setup guide
              <Icon.ExternalLink className="octo-icon-sm" aria-hidden />
            </Link>
          </Button>
        </div>

        <ol className="octo-chat-setup__steps">
          {setup.steps.map((step, index) => (
            <li key={step.title} className="octo-chat-setup__step">
              <span className="octo-chat-setup__step-index" aria-hidden>
                {index + 1}
              </span>
              <div className="octo-chat-setup__step-body">
                <div className="octo-chat-setup__step-title">{step.title}</div>
                <p className="octo-chat-setup__step-detail">{step.detail}</p>
                {step.code ? (
                  <pre className="octo-chat-setup__code">
                    <code>{step.code}</code>
                  </pre>
                ) : null}
              </div>
            </li>
          ))}
        </ol>

        <p className="octo-chat-setup__footer">
          Messages cannot be sent until credentials and config are in place. API routes at{' '}
          <code className="octo-u-mono">/api/octocms/agent</code> also return 404 until then — that is expected.
        </p>
      </div>
    </Page>
  );
}
