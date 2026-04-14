import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock theme context
const mockSetTheme = vi.fn();
let mockTheme = "system";

vi.mock("octocms/admin/ThemeProvider", () => ({
  useTheme: () => ({
    theme: mockTheme,
    resolvedTheme: mockTheme === "dark" ? "dark" : "light",
    setTheme: mockSetTheme,
  }),
}));

// Mock ui components as simple HTML equivalents so Radix context is not needed.
// DropdownMenuRadioGroup simulates value/onValueChange by forwarding clicks from
// child items that carry a data-radio-value attribute.
vi.mock("octocms/components/ui", () => ({
  DropdownMenuLabel: ({
    children,
    className,
  }: React.PropsWithChildren<{ className?: string }>) => (
    <div className={className}>{children}</div>
  ),
  DropdownMenuRadioGroup: ({
    children,
    value: groupValue,
    onValueChange,
  }: React.PropsWithChildren<{
    value?: string;
    onValueChange?: (v: string) => void;
  }>) => (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      onKeyDown={() => {}}
      onClick={(e: React.MouseEvent) => {
        const target = (e.target as HTMLElement).closest(
          "[data-radio-value]",
        ) as HTMLElement | null;
        if (target?.dataset.radioValue)
          onValueChange?.(target.dataset.radioValue);
      }}
      data-group-value={groupValue}
    >
      {children}
    </div>
  ),
  DropdownMenuRadioItem: ({
    children,
    value,
  }: React.PropsWithChildren<{ value: string }>) => (
    <div role="radio" aria-checked={false} data-radio-value={value}>
      {children}
    </div>
  ),
  DropdownMenuSeparator: () => <hr />,
}));

// Dynamic import after mocks are wired up
const { ThemeToggle } = await import("./ThemeToggle");

beforeEach(() => {
  vi.clearAllMocks();
  mockTheme = "system";
});

afterEach(() => {
  cleanup();
});

describe("ThemeToggle", () => {
  it("renders Light, Dark, and System radio items", () => {
    render(<ThemeToggle />);
    // Use getAllByText to handle icon + text siblings; at least one match must exist
    expect(screen.getAllByText("Light").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Dark").length).toBeGreaterThan(0);
    expect(screen.getAllByText("System").length).toBeGreaterThan(0);
  });

  it("renders the Appearance label", () => {
    render(<ThemeToggle />);
    expect(screen.getByText("Appearance")).toBeTruthy();
  });

  it('calls setTheme("dark") when the Dark radio item is clicked', () => {
    render(<ThemeToggle />);
    const darkItem = screen.getByRole("radio", { name: /dark/i });
    fireEvent.click(darkItem);
    expect(mockSetTheme).toHaveBeenCalledWith("dark");
  });

  it('calls setTheme("light") when the Light radio item is clicked', () => {
    render(<ThemeToggle />);
    const lightItem = screen.getByRole("radio", { name: /light/i });
    fireEvent.click(lightItem);
    expect(mockSetTheme).toHaveBeenCalledWith("light");
  });

  it('calls setTheme("system") when the System radio item is clicked', () => {
    render(<ThemeToggle />);
    const systemItem = screen.getByRole("radio", { name: /system/i });
    fireEvent.click(systemItem);
    expect(mockSetTheme).toHaveBeenCalledWith("system");
  });
});
