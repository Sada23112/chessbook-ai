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

  it('renders visual feedback: highlights selected square and legal destinations on tap', () => {
    const { container } = render(
      <InteractiveChessboard
        fen="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
        boardOrientation="white"
        allowMoves={true}
      />
    );

    const e2Square = container.querySelector('[data-square="e2"]') as HTMLElement;
    expect(e2Square).toBeTruthy();
    fireEvent.click(e2Square);

    // After clicking e2, e2's inner style div should have selected square highlight style
    const e2Inner = e2Square.querySelector('div') as HTMLElement;
    expect(e2Inner).toBeTruthy();
    expect(e2Inner.style.boxShadow).toContain('22c55e');

    // Legal destinations e3 and e4 should receive dot indicators
    const e4Square = container.querySelector('[data-square="e4"]') as HTMLElement;
    const e3Square = container.querySelector('[data-square="e3"]') as HTMLElement;
    expect(e4Square).toBeTruthy();
    expect(e3Square).toBeTruthy();
    const e4Inner = e4Square.querySelector('div') as HTMLElement;
    const e3Inner = e3Square.querySelector('div') as HTMLElement;
    expect(e4Inner.style.background).toContain('radial-gradient');
    expect(e3Inner.style.background).toContain('radial-gradient');
  });

  it('clears selectedSquare when an onMove callback rejects the move (returns false)', () => {
    // Rejects the first move (e.g. incorrect trainer solution)
    const onMoveMock = vi.fn().mockReturnValue(false);

    const { container } = render(
      <InteractiveChessboard
        fen="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
        boardOrientation="white"
        allowMoves={true}
        onMove={onMoveMock}
      />
    );

    const e2Square = container.querySelector('[data-square="e2"]') as HTMLElement;
    const e4Square = container.querySelector('[data-square="e4"]') as HTMLElement;

    // 1. Select e2 and move to e4 -> onMove returns false
    fireEvent.click(e2Square);
    fireEvent.click(e4Square);
    expect(onMoveMock).toHaveBeenCalledTimes(1);

    // 2. Now tap d2 (another pawn). Because selection was cleared, d2 should be selected,
    // not treated as an illegal move from e2 to d2!
    const d2Square = container.querySelector('[data-square="d2"]') as HTMLElement;
    const d4Square = container.querySelector('[data-square="d4"]') as HTMLElement;

    fireEvent.click(d2Square);
    // Move d2 to d4
    fireEvent.click(d4Square);
    expect(onMoveMock).toHaveBeenCalledTimes(2);
    expect(onMoveMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        from: 'd2',
        to: 'd4',
        san: 'd4',
      })
    );
  });

  it('does not trigger onMove when merely selecting a piece or tapping empty/illegal squares', () => {
    const onMoveMock = vi.fn();

    const { container } = render(
      <InteractiveChessboard
        fen="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
        boardOrientation="white"
        allowMoves={true}
        onMove={onMoveMock}
      />
    );

    // Click friendly piece
    const e2Square = container.querySelector('[data-square="e2"]') as HTMLElement;
    fireEvent.click(e2Square);
    expect(onMoveMock).not.toHaveBeenCalled();

    // Click empty square that is not a legal move (e.g. a4)
    const a4Square = container.querySelector('[data-square="a4"]') as HTMLElement;
    fireEvent.click(a4Square);
    expect(onMoveMock).not.toHaveBeenCalled();

    // Click an opponent piece that cannot be captured legally (e.g. e7)
    const e7Square = container.querySelector('[data-square="e7"]') as HTMLElement;
    fireEvent.click(e7Square);
    expect(onMoveMock).not.toHaveBeenCalled();
  });
});

