import { useState } from 'react';
import { Tournament as ParryggTournament } from '@parry-gg/client';
import SearchBox from './SearchBox';
import StartggView from './StartggView';
import {
  ChallongeTournament,
  GuideState,
  Mode,
  PlayerOverrides,
  RendererOfflineModeTournament,
  SelectedEvent,
  SelectedPhase,
  SelectedPhaseGroup,
  SelectedSetChain,
  Set,
  Tournament,
} from '../common/types';
import ChallongeView from './ChallongeView';
import ParryggView from './ParryggView';
import ManualView from './ManualView';
import ErrorDialog from './ErrorDialog';
import {
  assertInteger,
  assertIntegerOrUndefined,
  assertString,
  assertStringOrUndefined,
} from '../common/asserts';
import OfflineModeView from './OfflineModeView';

export default function RightColumn({
  mode,
  guideState,
  selectSet,
  setGuideState,
  vlerkMode,
  selectedSetChain,
  setSelectedSetChain,
  startggTournament,
  challongeTournaments,
  getChallongeTournament,
  setSelectedChallongeTournament,
  parryggTournament,
  offlineModeTournament,
  manualNames,
  selectedChipData,
  setSelectedChipData,
}: {
  mode: Mode;
  guideState: GuideState;
  selectSet: (set: Set) => void;
  setGuideState: (guideState: GuideState) => void;
  vlerkMode: boolean;
  selectedSetChain: SelectedSetChain;
  setSelectedSetChain: (selectedSetChain: SelectedSetChain) => void;
  startggTournament: Tournament;
  challongeTournaments: Map<string, ChallongeTournament>;
  getChallongeTournament: (maybeSlug: string) => Promise<void>;
  setSelectedChallongeTournament: (selectedChallongeTournament: {
    name: string;
    slug: string;
    tournamentType: string;
  }) => void;
  parryggTournament: ParryggTournament.AsObject | undefined;
  offlineModeTournament: RendererOfflineModeTournament;
  manualNames: string[];
  selectedChipData: PlayerOverrides;
  setSelectedChipData: (selectedChipData: PlayerOverrides) => void;
}) {
  const [searchSubstr, setSearchSubstr] = useState('');
  const [error, setError] = useState('');
  const [errorOpen, setErrorOpen] = useState(false);

  // start.gg tournament view
  const getPhaseGroup = async (id: number) => {
    try {
      await window.electron.getPhaseGroup(id);
    } catch (e: any) {
      setError(e.toString());
      setErrorOpen(true);
    }
  };
  const getPhase = async (id: number) => {
    try {
      await window.electron.getPhase(id);
    } catch (e: any) {
      setError(e.toString());
      setErrorOpen(true);
    }
  };

  const getEvent = async (id: number) => {
    try {
      await window.electron.getEvent(id);
    } catch (e: any) {
      setError(e.toString());
      setErrorOpen(true);
    }
  };

  const getParryggBracket = async (id: string) => {
    try {
      await window.electron.getParryggBracket(id);
    } catch (e: any) {
      setError(e.toString());
      setErrorOpen(true);
    }
  };

  const getParryggPhase = async (id: string) => {
    try {
      await window.electron.getParryggPhase(id);
    } catch (e: any) {
      setError(e.toString());
      setErrorOpen(true);
    }
  };

  const getParryggEvent = async (id: string) => {
    try {
      await window.electron.getParryggEvent(id);
    } catch (e: any) {
      setError(e.toString());
      setErrorOpen(true);
    }
  };

  const selectStartggSet = async (
    set: Set,
    phaseGroup: SelectedPhaseGroup,
    phase: SelectedPhase,
    event: SelectedEvent,
  ) => {
    selectSet(set);
    setSelectedSetChain({
      event,
      phase,
      phaseGroup,
    });
    await window.electron.setSelectedSetChain(
      assertInteger(event.id),
      assertInteger(phase.id),
      assertInteger(phaseGroup.id),
    );
  };
  const selectChallongeSet = async (
    set: Set,
    selectedTournament: ChallongeTournament,
  ) => {
    selectSet(set);
    setSelectedChallongeTournament({
      name: selectedTournament.name,
      slug: selectedTournament.slug,
      tournamentType: selectedTournament.tournamentType,
    });
    await window.electron.setSelectedChallongeTournament(
      selectedTournament.slug,
    );
  };
  const selectParryggSet = async (
    set: Set,
    phaseGroup: SelectedPhaseGroup,
    phase: SelectedPhase,
    event: SelectedEvent,
  ) => {
    selectSet(set);
    setSelectedSetChain({ event, phase, phaseGroup });
    await window.electron.setSelectedSetChain(
      assertString(event.id),
      assertString(phase.id),
      assertString(phaseGroup.id),
    );
  };
  const selectOfflineModeSet = async (
    set: Set,
    phaseGroup: SelectedPhaseGroup,
    phase: SelectedPhase,
    event: SelectedEvent,
  ) => {
    selectSet(set);
    setSelectedSetChain({ event, phase, phaseGroup });
    await window.electron.setSelectedSetChain(
      event.id,
      phase.id,
      phaseGroup.id,
    );
  };

  return (
    <>
      <SearchBox
        mode={mode}
        searchSubstr={searchSubstr}
        setSearchSubstr={setSearchSubstr}
        vlerkMode={vlerkMode}
      />
      {mode === Mode.STARTGG && (
        <StartggView
          searchSubstr={searchSubstr}
          tournament={startggTournament}
          vlerkMode={vlerkMode}
          selectedEventId={assertIntegerOrUndefined(selectedSetChain.event?.id)}
          selectedPhaseId={assertIntegerOrUndefined(selectedSetChain.phase?.id)}
          selectedPhaseGroupId={assertIntegerOrUndefined(
            selectedSetChain.phaseGroup?.id,
          )}
          getEvent={(id: number) => getEvent(id)}
          getPhase={(id: number) => getPhase(id)}
          getPhaseGroup={getPhaseGroup}
          selectSet={async (
            set: Set,
            phaseGroup: SelectedPhaseGroup,
            phase: SelectedPhase,
            event: SelectedEvent,
          ) => {
            await selectStartggSet(set, phaseGroup, phase, event);
            if (guideState !== GuideState.NONE) {
              setGuideState(GuideState.REPLAYS);
            }
          }}
        />
      )}
      {mode === Mode.CHALLONGE &&
        Array.from(challongeTournaments.values()).map((challongeTournament) => (
          <ChallongeView
            key={challongeTournament.slug}
            searchSubstr={searchSubstr}
            tournament={challongeTournament}
            getChallongeTournament={() =>
              getChallongeTournament(challongeTournament.slug)
            }
            selectSet={(set: Set) => {
              selectChallongeSet(set, challongeTournament);
              if (guideState !== GuideState.NONE) {
                setGuideState(GuideState.REPLAYS);
              }
            }}
          />
        ))}
      {mode === Mode.PARRYGG && (
        <ParryggView
          searchSubstr={searchSubstr}
          tournament={parryggTournament}
          vlerkMode={vlerkMode}
          selectedEventId={assertStringOrUndefined(selectedSetChain?.event?.id)}
          selectedPhaseId={assertStringOrUndefined(selectedSetChain?.phase?.id)}
          selectedBracketId={assertStringOrUndefined(
            selectedSetChain?.phaseGroup?.id,
          )}
          getEvent={getParryggEvent}
          getPhase={getParryggPhase}
          getBracket={getParryggBracket}
          selectSet={async (
            set: Set,
            bracket: SelectedPhaseGroup,
            phase: SelectedPhase,
            event: SelectedEvent,
          ) => {
            await selectParryggSet(set, bracket, phase, event);
            if (guideState !== GuideState.NONE) {
              setGuideState(GuideState.REPLAYS);
            }
          }}
        />
      )}
      {mode === Mode.OFFLINE_MODE && (
        <OfflineModeView
          searchSubstr={searchSubstr}
          offlineModeTournament={offlineModeTournament}
          vlerkMode={vlerkMode}
          selectedEventId={assertIntegerOrUndefined(selectedSetChain.event?.id)}
          selectedPhaseId={assertIntegerOrUndefined(selectedSetChain.phase?.id)}
          selectedPhaseGroupId={assertIntegerOrUndefined(
            selectedSetChain.phaseGroup?.id,
          )}
          selectSet={async (
            set: Set,
            phaseGroup: SelectedPhaseGroup,
            phase: SelectedPhase,
            event: SelectedEvent,
          ) => {
            await selectOfflineModeSet(set, phaseGroup, phase, event);
            if (guideState !== GuideState.NONE) {
              setGuideState(GuideState.REPLAYS);
            }
          }}
        />
      )}
      {mode === Mode.MANUAL && (
        <ManualView
          manualNames={manualNames}
          searchSubstr={searchSubstr}
          selectedChipData={selectedChipData}
          setSelectedChipData={setSelectedChipData}
        />
      )}
      <ErrorDialog
        messages={[error]}
        onClose={() => {
          setError('');
          setErrorOpen(false);
        }}
        open={errorOpen}
      />
    </>
  );
}
