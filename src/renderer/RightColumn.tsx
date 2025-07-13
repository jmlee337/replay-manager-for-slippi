import { useState } from 'react';
import SearchBox from './SearchBox';
import StartggView from './StartggView';
import {
  ChallongeTournament,
  GuideState,
  Mode,
  PlayerOverrides,
  SelectedEvent,
  SelectedPhase,
  SelectedPhaseGroup,
  Set,
  Tournament,
} from '../common/types';
import ChallongeView from './ChallongeView';
import ManualView from './ManualView';
import ErrorDialog from './ErrorDialog';

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
  manualNames,
  selectedChipData,
  setSelectedChipData,
}: {
  mode: Mode;
  guideState: GuideState;
  selectSet: (set: Set) => void;
  setGuideState: (guideState: GuideState) => void;
  vlerkMode: boolean;
  selectedSetChain: {
    event?: SelectedEvent;
    phase?: SelectedPhase;
    phaseGroup?: SelectedPhaseGroup;
  };
  setSelectedSetChain: (selectedSetChain: {
    event?: SelectedEvent;
    phase?: SelectedPhase;
    phaseGroup?: SelectedPhaseGroup;
  }) => void;
  startggTournament: Tournament;
  challongeTournaments: Map<string, ChallongeTournament>;
  getChallongeTournament: (maybeSlug: string) => Promise<void>;
  setSelectedChallongeTournament: (selectedChallongeTournament: {
    name: string;
    slug: string;
    tournamentType: string;
  }) => void;
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
      event.id,
      phase.id,
      phaseGroup.id,
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
          selectedEventId={selectedSetChain.event?.id}
          selectedPhaseId={selectedSetChain.phase?.id}
          selectedPhaseGroupId={selectedSetChain.phaseGroup?.id}
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
