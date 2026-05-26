import React from 'react';
import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { buildChatSetupInfo } from '../../agent/chatSetup';
import { renderWithQuery } from '../../admin/query/test/renderWithQuery';
import { ChatAgentSetup } from './ChatAgentSetup';

afterEach(() => {
  cleanup();
});

describe('ChatAgentSetup', () => {
  it('renders setup steps when agentConfig is missing', () => {
    const setup = buildChatSetupInfo(undefined);
    renderWithQuery(<ChatAgentSetup setup={setup} />);

    expect(screen.getByTestId('chat-agent-setup')).toBeDefined();
    expect(screen.getByRole('heading', { name: setup.headline })).toBeDefined();
    expect(screen.getByRole('link', { name: /Open setup guide/i }).getAttribute('href')).toBe(
      'https://octocms.com/docs/chat-agent',
    );
    expect(
      screen.getByText('Add agent settings to your project', { selector: '.octo-chat-setup__step-title' }),
    ).toBeDefined();
  });
});
