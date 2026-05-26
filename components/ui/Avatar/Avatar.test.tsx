import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { Avatar, AvatarFallback, AvatarImage } from './Avatar';

afterEach(cleanup);

describe('Avatar', () => {
  it('renders a container with octo-chip--avatar class', () => {
    const { container } = render(<Avatar />);
    expect(container.firstElementChild?.className).toContain('octo-chip--avatar');
  });

  it('accepts className and merges it', () => {
    const { container } = render(<Avatar className="extra" />);
    expect(container.firstElementChild?.className).toContain('extra');
    expect(container.firstElementChild?.className).toContain('octo-chip--avatar');
  });

  it('forwards ref to the container element', () => {
    const ref = React.createRef<HTMLSpanElement>();
    render(<Avatar ref={ref} />);
    expect(ref.current).not.toBeNull();
  });
});

describe('AvatarImage', () => {
  it('renders an <img> with octo-chip__avatar-img class', () => {
    render(
      <Avatar>
        <AvatarImage src="https://example.com/photo.jpg" alt="User" />
      </Avatar>,
    );
    const img = screen.getByRole('img');
    expect(img.tagName).toBe('IMG');
    expect(img.className).toContain('octo-chip__avatar-img');
  });

  it('passes src and alt to the img', () => {
    render(
      <Avatar>
        <AvatarImage src="https://example.com/photo.jpg" alt="Alice" />
      </Avatar>,
    );
    const img = screen.getByRole('img');
    expect(img.getAttribute('src')).toBe('https://example.com/photo.jpg');
    expect(img.getAttribute('alt')).toBe('Alice');
  });
});

describe('AvatarFallback', () => {
  it('renders fallback content when there is no image', () => {
    render(
      <Avatar>
        <AvatarFallback>AB</AvatarFallback>
      </Avatar>,
    );
    expect(screen.getByText('AB')).toBeDefined();
  });

  it('renders fallback with octo-chip__avatar-fallback class', () => {
    render(
      <Avatar>
        <AvatarFallback>AB</AvatarFallback>
      </Avatar>,
    );
    expect(screen.getByText('AB').className).toContain('octo-chip__avatar-fallback');
  });

  it('shows fallback when image fires an error', async () => {
    render(
      <Avatar>
        <AvatarImage src="bad-url.jpg" alt="User" />
        <AvatarFallback>AB</AvatarFallback>
      </Avatar>,
    );
    const img = screen.getByRole('img');
    act(() => {
      fireEvent.error(img);
    });
    await waitFor(() => expect(screen.getByText('AB')).toBeDefined());
  });

  it('hides fallback when image loads successfully', async () => {
    render(
      <Avatar>
        <AvatarImage src="good-url.jpg" alt="User" />
        <AvatarFallback>AB</AvatarFallback>
      </Avatar>,
    );
    const img = screen.getByRole('img');
    act(() => {
      fireEvent.load(img);
    });
    await waitFor(() => expect(screen.queryByText('AB')).toBeNull());
  });

  it('accepts extra className', () => {
    render(
      <Avatar>
        <AvatarFallback className="custom">AB</AvatarFallback>
      </Avatar>,
    );
    expect(screen.getByText('AB').className).toContain('custom');
  });
});
