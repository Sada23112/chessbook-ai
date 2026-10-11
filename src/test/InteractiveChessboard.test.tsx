import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { InteractiveChessboard } from '../components/common/InteractiveChessboard';

describe('InteractiveChessboard Component', () => {
  it('renders without crashing with starting position', () => {
    const { container } = render(
      <InteractiveChessboard
        fen="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
        boardOrientation="white"
      />
    );
    expect(container).toBeDefined();
  });

  it('allows selecting piece and moving to legal square via tap-to-move', () => {
    const onMoveMock = vi.fn().mockReturnValue(true);

    const { container } = render(
      <InteractiveChessboard
        fen="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
        boardOrientation="white"
        allowMoves={true}
        onMove={onMoveMock}
      />
    );

    // Find e2 square and click it to select
    const e2Square = container.querySelector('[data-square="e2"]');
    if (e2Square) {
      fireEvent.click(e2Square);

      // Click e4 destination square to move
      const e4Square = container.querySelector('[data-square="e4"]');
      if (e4Square) {
        fireEvent.click(e4Square);
        expect(onMoveMock).toHaveBeenCalledWith(
          expect.objectContaining({
            from: 'e2',
            to: 'e4',
            san: 'e4',
          })
        );
      }
    }
  });

  it('rejects illegal moves and does not trigger onMove', () => {
    const onMoveMock = vi.fn();

    const { container } = render(
      <InteractiveChessboard
        fen="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
        boardOrientation="white"
        allowMoves={true}
        onMove={onMoveMock}
      />
    );

    // Click e2 square
    const e2Square = container.querySelector('[data-square="e2"]');
    if (e2Square) {
      fireEvent.click(e2Square);

      // Attempt illegal move to e5
      const e5Square = container.querySelector('[data-square="e5"]');
      if (e5Square) {
        fireEvent.click(e5Square);
        expect(onMoveMock).not.toHaveBeenCalled();
      }
    }
  });

  it('deselects piece when clicking the same square a second time', () => {
    const onMoveMock = vi.fn();

    const { container } = render(
      <InteractiveChessboard
        fen="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
        boardOrientation="white"
        allowMoves={true}
        onMove={onMoveMock}
      />
    );

    const e2Square = container.querySelector('[data-square="e2"]');
    if (e2Square) {
      // First click: select
      fireEvent.click(e2Square);
      // Second click: deselect
      fireEvent.click(e2Square);

      // Now click e4: should not move because selection was cleared
      const e4Square = container.querySelector('[data-square="e4"]');
      if (e4Square) {
        fireEvent.click(e4Square);
        expect(onMoveMock).not.toHaveBeenCalled();
      }
    }
  });

  it('switches selection when clicking another friendly piece', () => {
    const onMoveMock = vi.fn().mockReturnValue(true);

    const { container } = render(
      <InteractiveChessboard
        fen="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
        boardOrientation="white"
        allowMoves={true}
        onMove={onMoveMock}
      />
    );

    // First click e2
    const e2Square = container.querySelector('[data-square="e2"]');
    if (e2Square) {
      fireEvent.click(e2Square);

      // Switch to g1 knight
      const g1Square = container.querySelector('[data-square="g1"]');
      if (g1Square) {
        fireEvent.click(g1Square);

        // Click f3 to move knight
        const f3Square = container.querySelector('[data-square="f3"]');
        if (f3Square) {
          fireEvent.click(f3Square);
          expect(onMoveMock).toHaveBeenCalledWith(
            expect.objectContaining({
              from: 'g1',
              to: 'f3',
              san: 'Nf3',
            })
          );
        }
      }
    }
  });
});
