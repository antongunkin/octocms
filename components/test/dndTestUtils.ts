import { act, fireEvent } from '@testing-library/react';

/**
 * Simulate native HTML5 drag-and-drop between two elements. Components that
 * track the dragged item in React state need `act()` between dragStart and drop
 * so the drop handler sees the updated drag handle.
 */
export async function fireDragReorder(source: Element, target: Element): Promise<void> {
  await act(async () => {
    fireEvent.dragStart(source);
  });
  await act(async () => {
    fireEvent.dragOver(target);
    fireEvent.drop(target);
  });
}
