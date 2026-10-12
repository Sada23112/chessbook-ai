import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type {
  OpeningRepertoire,
  RepertoireVariation,
  PieceColor,
  CourseLesson,
  LearningMode,
} from '../../types/chess';
import { db } from '../../db/db';
import {
  seedMasterRepertoires,
  MASTER_OPENING_REPERTOIRES,
} from '../../repertoire/defaultOpenings';
import {
  createDefaultRepertoire,
  addLineToRepertoire,
  copyVariationToRepertoire,
  detectGameDeviations,
  type DeviationResult,
} from '../../repertoire/repertoireEngine';
import { buildCourseFromRepertoire } from '../../repertoire/courseEngine';
import { OpeningLibraryView } from './OpeningLibraryView';
import { OpeningCourseView } from './OpeningCourseView';
import { OpeningDetailsView } from './OpeningDetailsView';
import { OpeningTrainingView } from './OpeningTrainingView';
import { AntiOpeningTrainerView } from './AntiOpeningTrainerView';

export type OpeningBookScreen = 'library' | 'course' | 'details' | 'training' | 'anti_opening';

export const OpeningBookView: React.FC = () => {
  const [screen, setScreen] = useState<OpeningBookScreen>('library');
  const [repertoires, setRepertoires] = useState<OpeningRepertoire[]>([]);
  const [selectedRepertoireId, setSelectedRepertoireId] = useState<string>('');
  const [selectedVariation, setSelectedVariation] = useState<RepertoireVariation | undefined>(
    undefined
  );
  const [selectedLesson, setSelectedLesson] = useState<CourseLesson | undefined>(undefined);
  const [trainingMode, setTrainingMode] = useState<LearningMode | undefined>(undefined);
  const [isRecallTest, setIsRecallTest] = useState<boolean>(false);
  const [antiOpeningTargetId, setAntiOpeningTargetId] = useState<string | undefined>(undefined);
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

  const activeRepertoire =
    repertoires.find((r) => r.id === selectedRepertoireId) || repertoires[0];

  const activeCourse = useMemo(() => {
    if (!activeRepertoire) return undefined;
    return buildCourseFromRepertoire(activeRepertoire);
  }, [activeRepertoire]);

  // Transition handlers
  const handleSelectOpening = (
    repertoire: OpeningRepertoire,
    variation?: RepertoireVariation
  ) => {
    setSelectedRepertoireId(repertoire.id);
    setSelectedVariation(variation || repertoire.variations?.[0]);
    // Always navigate to the dedicated level-based Course Details page
    setScreen('course');
  };

  const handleStartTraining = (
    repertoire: OpeningRepertoire,
    variation?: RepertoireVariation
  ) => {
    setSelectedRepertoireId(repertoire.id);
    const targetVar = variation || repertoire.variations?.[0];
    setSelectedVariation(targetVar);

    // Identify corresponding course lesson
    const course = buildCourseFromRepertoire(repertoire);
    const foundLesson = course.lessons.find((l) =>
      l.variations.some((v) => v.id === targetVar?.id)
    );
    setSelectedLesson(foundLesson || course.lessons[0]);
    setTrainingMode(undefined);
    setIsRecallTest(false);
    setScreen('training');
  };

  const handleStartLessonTraining = (
    repertoire: OpeningRepertoire,
    lesson: CourseLesson,
    variationId?: string,
    mode?: LearningMode,
    isRecall?: boolean
  ) => {
    setSelectedRepertoireId(repertoire.id);
    setSelectedLesson(lesson);
    const targetVar =
      lesson.variations.find((v) => v.id === variationId) || lesson.variations[0];
    setSelectedVariation(targetVar);
    setTrainingMode(mode);
    setIsRecallTest(isRecall ?? false);
    setScreen('training');
  };

  const handleStartRecallTest = (lesson: CourseLesson) => {
    setSelectedLesson(lesson);
    if (lesson.variations.length > 0) {
      setSelectedVariation(lesson.variations[0]);
    }
    setTrainingMode('recall');
    setIsRecallTest(true);
    setScreen('training');
  };

  const handleNextVariationInTraining = () => {
    if (selectedLesson && selectedLesson.variations.length > 0) {
      const currentIndex = selectedLesson.variations.findIndex(
        (v) => v.id === selectedVariation?.id
      );
      if (currentIndex >= 0 && currentIndex < selectedLesson.variations.length - 1) {
        setSelectedVariation(selectedLesson.variations[currentIndex + 1]);
        return;
      }

      // Check if next lesson exists in the active course
      if (activeCourse) {
        const lessonIndex = activeCourse.lessons.findIndex(
          (l) => l.id === selectedLesson.id
        );
        if (lessonIndex >= 0 && lessonIndex < activeCourse.lessons.length - 1) {
          const nextLesson = activeCourse.lessons[lessonIndex + 1];
          setSelectedLesson(nextLesson);
          setSelectedVariation(nextLesson.variations[0]);
          return;
        }
      }
    }

    // Fallback: cycle through active repertoire variations
    if (!activeRepertoire?.variations || activeRepertoire.variations.length === 0) return;
    const currentIndex = activeRepertoire.variations.findIndex(
      (v) => v.id === selectedVariation?.id
    );
    const nextIndex = (currentIndex + 1) % activeRepertoire.variations.length;
    setSelectedVariation(activeRepertoire.variations[nextIndex]);
  };

  const handleAdvanceToNextLesson = (nextLesson: CourseLesson) => {
    setSelectedLesson(nextLesson);
    setSelectedVariation(nextLesson.variations[0]);
    setTrainingMode('guided');
    setIsRecallTest(false);
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
    setSelectedLesson(undefined);
    setScreen('course');
  };

  const handleOpenAntiOpeningTrainer = (openingId?: string) => {
    setAntiOpeningTargetId(openingId);
    setScreen('anti_opening');
  };

  const handleCopyToRepertoire = async (targetRepId: string, variation: RepertoireVariation) => {
    const target = repertoires.find((r) => r.id === targetRepId);
    if (!target) return;
    const updated = copyVariationToRepertoire(target, variation);
    await db.repertoires.put(updated);
    await loadRepertoires(false);
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
          onOpenAntiOpeningTrainer={handleOpenAntiOpeningTrainer}
          onCopyToRepertoire={handleCopyToRepertoire}
          isReseeding={isReseeding}
        />
      )}

      {screen === 'course' && activeRepertoire && (
        <OpeningCourseView
          repertoire={activeRepertoire}
          onBackToLibrary={() => setScreen('library')}
          onStartLessonTraining={handleStartLessonTraining}
          onBrowseMoveTree={(rep, v) => {
            setSelectedRepertoireId(rep.id);
            setSelectedVariation(v || rep.variations?.[0]);
            setScreen('details');
          }}
        />
      )}

      {screen === 'details' && activeRepertoire && (
        <OpeningDetailsView
          repertoire={activeRepertoire}
          initialVariation={selectedVariation}
          deviations={deviations}
          onBackToLibrary={() => setScreen('course')}
          onStartTraining={(rep, v) => handleStartTraining(rep, v)}
          onRepertoireUpdated={() => loadRepertoires(false)}
        />
      )}

      {screen === 'training' && activeRepertoire && (
        <OpeningTrainingView
          repertoire={activeRepertoire}
          variation={
            selectedVariation ||
            activeRepertoire.variations?.[0] || {
              id: 'temp_var',
              name: activeRepertoire.name,
              moves: [],
            }
          }
          course={activeCourse}
          lesson={selectedLesson}
          initialMode={trainingMode}
          isRecallTest={isRecallTest}
          onExitTraining={() => setScreen('course')}
          onSelectNextVariation={handleNextVariationInTraining}
          onAdvanceToNextLesson={handleAdvanceToNextLesson}
          onStartRecallTest={handleStartRecallTest}
        />
      )}

      {screen === 'anti_opening' && (
        <AntiOpeningTrainerView
          initialOpeningId={antiOpeningTargetId}
          onExit={() => setScreen('library')}
        />
      )}
    </div>
  );
};
