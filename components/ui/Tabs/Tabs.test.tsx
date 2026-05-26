import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Tabs, TabsContent, TabsList, TabsTrigger } from './Tabs';

afterEach(cleanup);

// ── Helpers ──────────────────────────────────────────────────────────────────

function BasicTabs({
  defaultValue = 'a',
  value,
  onValueChange,
}: {
  defaultValue?: string;
  value?: string;
  onValueChange?: (v: string) => void;
}) {
  return (
    <Tabs defaultValue={defaultValue} value={value} onValueChange={onValueChange}>
      <TabsList>
        <TabsTrigger value="a">Tab A</TabsTrigger>
        <TabsTrigger value="b">Tab B</TabsTrigger>
        <TabsTrigger value="c">Tab C</TabsTrigger>
      </TabsList>
      <TabsContent value="a">Panel A</TabsContent>
      <TabsContent value="b">Panel B</TabsContent>
      <TabsContent value="c">Panel C</TabsContent>
    </Tabs>
  );
}

// ── Structure & ARIA ──────────────────────────────────────────────────────────

describe('Tabs structure', () => {
  it('renders a tablist', () => {
    render(<BasicTabs />);
    expect(screen.getByRole('tablist')).toBeDefined();
  });

  it('renders tabs with role="tab"', () => {
    render(<BasicTabs />);
    expect(screen.getAllByRole('tab')).toHaveLength(3);
  });

  it('renders the active tabpanel', () => {
    render(<BasicTabs />);
    expect(screen.getByRole('tabpanel')).toBeDefined();
    expect(screen.getByRole('tabpanel').textContent).toBe('Panel A');
  });

  it('does not render inactive panels', () => {
    render(<BasicTabs />);
    expect(screen.queryByText('Panel B')).toBeNull();
    expect(screen.queryByText('Panel C')).toBeNull();
  });
});

// ── data-state & aria-selected ────────────────────────────────────────────────

describe('Tabs active state', () => {
  it('active trigger has data-state="active"', () => {
    render(<BasicTabs defaultValue="b" />);
    const triggerB = screen.getByRole('tab', { name: 'Tab B' });
    expect(triggerB.getAttribute('data-state')).toBe('active');
  });

  it('inactive trigger has data-state="inactive"', () => {
    render(<BasicTabs defaultValue="b" />);
    const triggerA = screen.getByRole('tab', { name: 'Tab A' });
    expect(triggerA.getAttribute('data-state')).toBe('inactive');
  });

  it('active trigger has aria-selected="true"', () => {
    render(<BasicTabs defaultValue="a" />);
    expect(screen.getByRole('tab', { name: 'Tab A' }).getAttribute('aria-selected')).toBe('true');
  });

  it('inactive trigger has aria-selected="false"', () => {
    render(<BasicTabs defaultValue="a" />);
    expect(screen.getByRole('tab', { name: 'Tab B' }).getAttribute('aria-selected')).toBe('false');
  });

  it('active trigger has aria-controls pointing to its panel', () => {
    render(<BasicTabs defaultValue="a" />);
    const trigger = screen.getByRole('tab', { name: 'Tab A' });
    const panel = screen.getByRole('tabpanel');
    expect(trigger.getAttribute('aria-controls')).toBe(panel.id);
  });
});

// ── Click interaction ─────────────────────────────────────────────────────────

describe('Tabs click', () => {
  it('clicking a trigger calls onValueChange with its value', () => {
    const onValueChange = vi.fn();
    render(<BasicTabs onValueChange={onValueChange} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Tab B' }));
    expect(onValueChange).toHaveBeenCalledWith('b');
  });

  it('clicking a trigger switches the active panel (uncontrolled)', () => {
    render(<BasicTabs />);
    fireEvent.click(screen.getByRole('tab', { name: 'Tab B' }));
    expect(screen.getByRole('tabpanel').textContent).toBe('Panel B');
    expect(screen.queryByText('Panel A')).toBeNull();
  });

  it('does not call onValueChange when clicking the already-active trigger', () => {
    const onValueChange = vi.fn();
    render(<BasicTabs defaultValue="a" onValueChange={onValueChange} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Tab A' }));
    expect(onValueChange).not.toHaveBeenCalled();
  });
});

// ── Controlled mode ───────────────────────────────────────────────────────────

describe('Tabs controlled', () => {
  it('shows the panel matching the controlled value', () => {
    render(<BasicTabs value="c" />);
    expect(screen.getByRole('tabpanel').textContent).toBe('Panel C');
  });

  it('does not change panel when value prop is fixed', () => {
    render(<BasicTabs value="a" />);
    fireEvent.click(screen.getByRole('tab', { name: 'Tab B' }));
    // still shows A because no state update from parent
    expect(screen.getByRole('tabpanel').textContent).toBe('Panel A');
  });
});

// ── Keyboard navigation ───────────────────────────────────────────────────────

describe('Tabs keyboard nav', () => {
  it('ArrowRight moves focus to the next trigger', () => {
    render(<BasicTabs />);
    const triggerA = screen.getByRole('tab', { name: 'Tab A' });
    const triggerB = screen.getByRole('tab', { name: 'Tab B' });
    triggerA.focus();
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(triggerB);
  });

  it('ArrowLeft moves focus to the previous trigger', () => {
    render(<BasicTabs />);
    const triggerA = screen.getByRole('tab', { name: 'Tab A' });
    const triggerB = screen.getByRole('tab', { name: 'Tab B' });
    triggerB.focus();
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(triggerA);
  });

  it('ArrowRight wraps from last to first', () => {
    render(<BasicTabs />);
    const triggerA = screen.getByRole('tab', { name: 'Tab A' });
    const triggerC = screen.getByRole('tab', { name: 'Tab C' });
    triggerC.focus();
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(triggerA);
  });

  it('Home moves focus to the first trigger', () => {
    render(<BasicTabs />);
    const triggerA = screen.getByRole('tab', { name: 'Tab A' });
    const triggerC = screen.getByRole('tab', { name: 'Tab C' });
    triggerC.focus();
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'Home' });
    expect(document.activeElement).toBe(triggerA);
  });

  it('End moves focus to the last trigger', () => {
    render(<BasicTabs />);
    const triggerA = screen.getByRole('tab', { name: 'Tab A' });
    const triggerC = screen.getByRole('tab', { name: 'Tab C' });
    triggerA.focus();
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'End' });
    expect(document.activeElement).toBe(triggerC);
  });

  it('arrow key also activates the focused trigger (auto-activation)', () => {
    render(<BasicTabs />);
    screen.getByRole('tab', { name: 'Tab A' }).focus();
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowRight' });
    expect(screen.getByRole('tabpanel').textContent).toBe('Panel B');
  });
});

// ── Disabled ──────────────────────────────────────────────────────────────────

function TabsWithDisabled() {
  return (
    <Tabs defaultValue="a">
      <TabsList>
        <TabsTrigger value="a">Tab A</TabsTrigger>
        <TabsTrigger value="b" disabled>
          Tab B
        </TabsTrigger>
        <TabsTrigger value="c">Tab C</TabsTrigger>
      </TabsList>
      <TabsContent value="a">Panel A</TabsContent>
      <TabsContent value="b">Panel B</TabsContent>
      <TabsContent value="c">Panel C</TabsContent>
    </Tabs>
  );
}

describe('Tabs disabled trigger', () => {
  it('disabled trigger has data-disabled attribute', () => {
    render(<TabsWithDisabled />);
    expect(screen.getByRole('tab', { name: 'Tab B' }).hasAttribute('data-disabled')).toBe(true);
  });

  it('arrow key skips the disabled trigger', () => {
    render(<TabsWithDisabled />);
    const triggerA = screen.getByRole('tab', { name: 'Tab A' });
    const triggerC = screen.getByRole('tab', { name: 'Tab C' });
    triggerA.focus();
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(triggerC);
  });
});

// ── Variant classes ────────────────────────────────────────────────────────────

describe('Tabs variants', () => {
  it('TabsList uses the shared switcher class', () => {
    render(<BasicTabs />);
    expect(screen.getByRole('tablist').className).toContain('octo-switcher');
  });

  it('TabsTrigger uses the shared switcher item class', () => {
    render(<BasicTabs />);
    expect(screen.getAllByRole('tab')[0].className).toContain('octo-switcher__item');
  });
});
