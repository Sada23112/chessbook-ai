import React, { useState, useEffect, useCallback } from 'react';
import type { OpeningRepertoire, RepertoireVariation, PieceColor } from '../../types/chess';
import { db } from '../../db/db';
import {
  seedMasterRepertoires,
  MASTER_OPENING_REPERTOIRES,
} from '../../repertoire/defaultOpenings';
import {
  createDefaultRepertoire,
  addLineToRepertoire,
  detectGameDeviations,
  type DeviationResult,
} from '../../repertoire/repertoireEngine';
import { OpeningLibraryView } from './OpeningLibraryView';
import { OpeningDetailsView } from './OpeningDetailsView';
import { OpeningTrainingView } from './OpeningTrainingView';

export type OpeningBookScreen = 'library' | 'details' | 'training';

export const OpeningBookView: React.FC = () => {
  const [screen, setScreen] = useState<OpeningBookScreen>('library');
  const [repertoires, setRepertoires] = useState<OpeningRepertoire[]>([]);
  const [selectedRepertoireId, setSelectedRepertoireId] = useState<string>('');
  const [selectedVariation, setSelectedVariation] = useState<RepertoireVariation | undefined>(undefined);
  const [deviations, setDeviations] = useState<DeviationResult[]>([]);
  const [isReseeding, setIsReseeding] = useState<boolean>(false);

  // Load repertoires and compute user game deviations
  const loadRepertoires = useCallback(async (forceSeed = false) => {
    setIsReseeding(true);
    try {
      let list = await db.repertoires.toArray();
      // If table is empty, or forceSeed, or missing newly added master repertoires
      if (list.length === 0 || forceSeed || list.length < MASTER_OPENING_REPERTOIRES.length) {
        list = await seedMasterRepertoires(forceSeed);
      }

      setRepertoires(list);
      if (!selectedRepertoireId && list.length > 0) {
        setSelectedRepertoireId(list[0].id);
      }

      // Check deviations across user games
      const games = await db.games.toArray();
      const allDeviations: DeviationResult[] = [];
      for (const g of games) {
        const devs = detectGameDeviations(g, list);
        allDeviations.push(...devs);
      }
      setDeviations(allDeviations);
    } catch (err) {
      console.warn('Error loading opening repertoires:', err);
    } finally {
      setIsReseeding(false);
    }
  }, [selectedRepertoireId]);

  useEffect(() => {
    loadRepertoires(false);
  }, []);

  const activeRepertoire = repertoires.find((r) => r.id === selectedRepertoireId) || repertoires[0];

  // Transition handlers
  const handleSelectOpening = (repertoire: OpeningRepertoire, variation?: RepertoireVariation) => {
    setSelectedRepertoireId(repertoire.id);
    setSelectedVariation(variation || repertoire.variations?.[0]);
    setScreen('details');
  };

  const handleStartTraining = (repertoire: OpeningRepertoire, variation?: RepertoireVariation) => {
    setSelectedRepertoireId(repertoire.id);
    setSelectedVariation(variation || repertoire.variations?.[0]);
    setScreen('training');
  };

  const handleNextVariationInTraining = () => {
    if (!activeRepertoire?.variations || activeRepertoire.variations.length === 0) return;
    const currentIndex = activeRepertoire.variations.findIndex(
      (v) => v.id === selectedVariation?.id
    );
    const nextIndex = (currentIndex + 1) % activeRepertoire.variations.length;
    setSelectedVariation(activeRepertoire.variations[nextIndex]);
  };

  const handleImportPgn = async (repertoireId: string, pgn: string, name?: string) => {
    const target = repertoires.find((r) => r.id === repertoireId) || activeRepertoire;
    if (!target) return;

    try {
      const { Chess } = await import('chess.js');
      const chess = new Chess();
      chess.loadPgn(pgn);
      const history = chess.history();
      if (history.length === 0) return;

      const varName = name?.trim() || `Imported Line (${history.slice(0, 3).join(' ')}...)`;
      const newVar: RepertoireVariation = {
        id: `var_imp_${Date.now()}`,
        name: varName,
        moves: history,
        description: 'User-imported PGN opening line.',
      };

      let updated = addLineToRepertoire(target, history, varName);
      updated = {
        ...updated,
        variations: [...(updated.variations || []), newVar],
      };

      await db.repertoires.put(updated);
      await loadRepertoires(false);
      handleSelectOpening(updated, newVar);
    } catch {
      alert('Invalid PGN move sequence.');
    }
  };

  const handleCreateRepertoire = async (
    name: string,
    color: PieceColor,
    sideAgainst?: 'e4' | 'd4' | 'other'
  ) => {
    const id = `rep_custom_${Date.now()}`;
    const newRep = createDefaultRepertoire(id, name, color, sideAgainst);
    await db.repertoires.put(newRep);
    await loadRepertoires(false);
    setSelectedRepertoireId(id);
    setSelectedVariation(undefined);
    setScreen('details');
  };

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden bg-background">
      {screen === 'library' && (
        <OpeningLibraryView
          repertoires={repertoires}
          onSelectOpening={handleSelectOpening}
          onStartTraining={handleStartTraining}
          onReseedMasterOpenings={() => loadRepertoires(true)}
          onImportPgn={handleImportPgn}
          onCreateRepertoire={handleCreateRepertoire}
          isReseeding={isReseeding}
        />
      )}

      {screen === 'details' && activeRepertoire && (
        <OpeningDetailsView
          repertoire={activeRepertoire}
          initialVariation={selectedVariation}
          deviations={deviations}
          onBackToLibrary={() => setScreen('library')}
          onStartTraining={(rep, v) => handleStartTraining(rep, v)}
          onRepertoireUpdated={() => loadRepertoires(false)}
        />
      )}

      {screen === 'training' && activeRepertoire && (
        <OpeningTrainingView
          repertoire={activeRepertoire}
          variation={selectedVariation || activeRepertoire.variations?.[0] || {
            id: 'temp_var',
            name: activeRepertoire.name,
            moves: [],
          }}
          onExitTraining={() => setScreen('details')}
          onSelectNextVariation={handleNextVariationInTraining}
        />
      )}
    </div>
  );
};
