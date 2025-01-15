import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  AppBar,
  Backdrop,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputBase,
  ListItem,
  Paper,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  ArrowDownward,
  ArrowUpward,
  Backup,
  DeleteForever,
  DeleteForeverOutlined,
  Edit,
  FolderOpen,
  HourglassTop,
  Refresh,
} from '@mui/icons-material';
import styled from '@emotion/styled';
import { format } from 'date-fns';
import { GlobalHotKeys } from 'react-hotkeys';
import {
  AdminedTournament,
  ChallongeMatchItem,
  ChallongeTournament,
  Context,
  ContextScore,
  ContextSlot,
  CopySettings,
  GuideState,
  InvalidReplay,
  Mode,
  Output,
  PlayerOverrides,
  Replay,
  ReportSettings,
  SelectedEvent,
  SelectedPhase,
  SelectedPhaseGroup,
  Set,
  StartggSet,
  State,
  Tournament,
} from '../common/types';
import { DraggableChip, DroppableChip } from './DragAndDrop';
import ReplayList, { SkewReplay } from './ReplayList';
import StartggView from './StartggView';
import './App.css';
import CopyControls from './CopyControls';
import SetControls from './SetControls';
import ErrorDialog from './ErrorDialog';
import Settings from './Settings';
import ManualReport from './ManualReport';
import {
  characterNames,
  frameMsDivisor,
  stageNames,
} from '../common/constants';
import ManualView from './ManualView';
import ManualBar from './ManualBar';
import ChallongeView from './ChallongeView';
import SearchBox from './SearchBox';
import GuidedDialog from './GuidedDialog';
import StartggTournamentForm from './StartggTournamentForm';
import ChallongeTournamentForm from './ChallongeTournamentForm';

const Bottom = styled(Paper)`
  height: 147px;
`;

const BottomColumns = styled(Stack)`
  box-sizing: border-box;
  height: 100%;
  padding: 8px;
`;

const TopColumns = styled(Stack)`
  flex-grow: 1;
  max-height: calc(100% - 147px);
  padding: 0 8px;
`;

const TopColumn = styled(Stack)`
  flex-shrink: 1;
  overflow-y: scroll;
  padding: 64px 0 8px;
`;

const AppBarSection = styled(Stack)`
  flex-shrink: 1;
  padding: 8px;
`;

const EMPTY_SET: Set = {
  id: 0,
  state: State.PENDING,
  round: 0,
  fullRoundText: '',
  winnerId: null,
  entrant1Id: 0,
  entrant1Participants: [
    {
      displayName: '',
      prefix: '',
      pronouns: '',
    },
  ],
  entrant1Score: null,
  entrant2Id: 0,
  entrant2Participants: [
    {
      displayName: '',
      prefix: '',
      pronouns: '',
    },
  ],
  entrant2Score: null,
  stream: null,
  ordinal: null,
  wasReported: false,
  updatedAtMs: 0,
};

const EMPTY_SELECTED_SET_CHAIN: {
  event?: SelectedEvent;
  phase?: SelectedPhase;
  phaseGroup?: SelectedPhaseGroup;
} = {
  event: undefined,
  phase: undefined,
  phaseGroup: undefined,
};

function hasTimeSkew(replays: Replay[]) {
  if (replays.length < 2) {
    return false;
  }

  for (let i = 0; i < replays.length - 1; i += 1) {
    const firstMs = replays[i].startAt?.getTime();
    const secondMs = replays[i + 1].startAt?.getTime();
    if (
      firstMs !== undefined &&
      secondMs !== undefined &&
      secondMs - firstMs > 3600000
    ) {
      return true;
    }
  }
  return false;
}

function Hello() {
  const [errors, setErrors] = useState<string[]>([]);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const showErrorDialog = (messages: string[]) => {
    setErrors(messages);
    setErrorDialogOpen(true);
  };

  // settings
  const [gotSettings, setGotSettings] = useState(false);
  const [mode, setMode] = useState<Mode>(Mode.STARTGG);
  const [startggApiKey, setStartggApiKey] = useState('');
  const [challongeApiKey, setChallongeApiKey] = useState('');
  const [autoDetectUsb, setAutoDetectUsb] = useState(false);
  const [scrollToBottom, setScrollToBottom] = useState(false);
  const [useEnforcer, setUseEnforcer] = useState(false);
  const [vlerkMode, setVlerkMode] = useState(false);
  const [guidedMode, setGuidedMode] = useState(false);
  const [fileNameFormat, setFileNameFormat] = useState('');
  const [folderNameFormat, setFolderNameFormat] = useState('');
  const [appVersion, setAppVersion] = useState('');
  const [latestAppVersion, setLatestAppVersion] = useState('');
  const [copySettings, setCopySettings] = useState<CopySettings>({
    output: Output.FILES,
    writeContext: false,
    writeDisplayNames: false,
    writeFileNames: false,
    writeStartTimes: false,
  });
  const [reportSettings, setReportSettings] = useState<ReportSettings>({
    alsoCopy: false,
    alsoDelete: false,
  });
  const [adminedTournaments, setAdminedTournaments] = useState<
    AdminedTournament[]
  >([]);
  const [gettingAdminedTournaments, setGettingAdminedTournaments] =
    useState(true);

  // initial state
  const [dir, setDir] = useState('');
  const [dirInit, setDirInit] = useState(false);
  const [copyDir, setCopyDir] = useState('');
  const [selectedSet, setSelectedSet] = useState<Set>(EMPTY_SET);
  const [selectedSetChain, setSelectedSetChain] = useState(
    EMPTY_SELECTED_SET_CHAIN,
  );
  const [slug, setSlug] = useState('');
  const [tournament, setTournament] = useState<Tournament>({
    slug: '',
    name: '',
    location: '',
    events: [],
  });
  const [challongeTournaments, setChallongeTournaments] = useState(
    new Map<string, ChallongeTournament>(),
  );
  const [selectedChallongeTournament, setSelectedChallongeTournament] =
    useState({ name: '', slug: '', tournamentType: '' });
  const [manualNames, setManualNames] = useState<string[]>([]);
  useEffect(() => {
    const inner = async () => {
      const appVersionPromise = window.electron.getVersion();
      const modePromise = window.electron.getMode();
      const startggKeyPromise = window.electron.getStartggKey();
      const challongeKeyPromise = window.electron.getChallongeKey();
      const autoDetectUsbPromise = window.electron.getAutoDetectUsb();
      const scrollToBottomPromise = window.electron.getScrollToBottom();
      const useEnforcerPromise = window.electron.getUseEnforcer();
      const vlerkModePromise = window.electron.getVlerkMode();
      const guidedModePromise = window.electron.getGuidedMode();
      const fileNameFormatPromise = window.electron.getFileNameFormat();
      const folderNameFormatPromise = window.electron.getFolderNameFormat();
      const copySettingsPromise = window.electron.getCopySettings();
      const reportSettingsPromise = window.electron.getReportSettings();

      // initial state
      const replaysDirPromise = window.electron.getReplaysDir();
      const copyDirPromise = window.electron.getCopyDir();
      const tournamentPromise = window.electron.getCurrentTournament();
      const selectedSetPromise = window.electron.getSelectedSet();
      const selectedSetChainPromise = window.electron.getSelectedSetChain();
      const challongeTournamentsPromise =
        window.electron.getCurrentChallongeTournaments();
      const selectedChallongeTournamentPromise =
        window.electron.getSelectedChallongeTournament();
      const manualNamesPromise = window.electron.getManualNames();

      // req network
      const latestAppVersionPromise = window.electron.getLatestVersion();
      const tournamentsPromise = window.electron.getTournaments();

      setAppVersion(await appVersionPromise);
      setMode(await modePromise);
      setStartggApiKey(await startggKeyPromise);
      setChallongeApiKey(await challongeKeyPromise);
      setAutoDetectUsb(await autoDetectUsbPromise);
      setScrollToBottom(await scrollToBottomPromise);
      setUseEnforcer(await useEnforcerPromise);
      setFileNameFormat(await fileNameFormatPromise);
      setFolderNameFormat(await folderNameFormatPromise);
      setVlerkMode(await vlerkModePromise);
      setGuidedMode(await guidedModePromise);
      setCopySettings(await copySettingsPromise);
      setReportSettings(await reportSettingsPromise);

      // initial state
      const replaysDir = await replaysDirPromise;
      setDir(replaysDir);
      setDirInit(replaysDir.length > 0);
      setCopyDir(await copyDirPromise);
      const currentTournament = await tournamentPromise;
      if (currentTournament) {
        setSlug(currentTournament.slug);
        setTournament(currentTournament);
      }
      const initSelectedSet = await selectedSetPromise;
      if (initSelectedSet) {
        setSelectedSet(initSelectedSet);
      }
      const initSelectedSetChain = await selectedSetChainPromise;
      const { event, phase, phaseGroup } = initSelectedSetChain;
      setSelectedSetChain({
        event,
        phase,
        phaseGroup,
      });
      setChallongeTournaments(await challongeTournamentsPromise);
      const initSelectedChallongeTournament =
        await selectedChallongeTournamentPromise;
      if (initSelectedChallongeTournament) {
        setSelectedChallongeTournament(initSelectedChallongeTournament);
      }
      setManualNames(await manualNamesPromise);

      // req network
      const errorMessages: string[] = [];
      try {
        setLatestAppVersion(await latestAppVersionPromise);
      } catch (e: any) {
        errorMessages.push(
          `Unable to check for updates: ${e instanceof Error ? e.message : e}`,
        );
      }
      try {
        setAdminedTournaments(await tournamentsPromise);
      } catch (e: any) {
        errorMessages.push(
          `Unable to fetch admined tournaments: ${
            e instanceof Error ? e.message : e
          }`,
        );
      }
      setGettingAdminedTournaments(false);
      if (errorMessages.length > 0) {
        showErrorDialog(errorMessages);
      }

      setGotSettings(true);
    };
    inner();
  }, []);

  const [batchActives, setBatchActives] = useState([
    { active: false, teamI: -1 },
    { active: false, teamI: -1 },
    { active: false, teamI: -1 },
    { active: false, teamI: -1 },
  ]);
  const numBatchActive = batchActives.filter(
    (batchActive) => batchActive.active,
  ).length;
  const [overrides, setOverrides] = useState<PlayerOverrides[]>([
    { displayName: '', entrantId: 0, prefix: '', pronouns: '' },
    { displayName: '', entrantId: 0, prefix: '', pronouns: '' },
    { displayName: '', entrantId: 0, prefix: '', pronouns: '' },
    { displayName: '', entrantId: 0, prefix: '', pronouns: '' },
  ]);
  const resetOverrides = () => {
    setOverrides([
      { displayName: '', entrantId: 0, prefix: '', pronouns: '' },
      { displayName: '', entrantId: 0, prefix: '', pronouns: '' },
      { displayName: '', entrantId: 0, prefix: '', pronouns: '' },
      { displayName: '', entrantId: 0, prefix: '', pronouns: '' },
    ]);
  };
  const [dq, setDq] = useState({ displayName: '', entrantId: 0 });
  const resetDq = () => {
    setDq({ displayName: '', entrantId: 0 });
  };

  // Replay list
  const [allReplaysSelected, setAllReplaysSelected] = useState(true);
  const [dirDeleteDialogOpen, setDirDeleteDialogOpen] = useState(false);
  const [dirDeleting, setDirDeleting] = useState(false);
  const [dirExists, setDirExists] = useState(true);
  const [replays, setReplays] = useState<Replay[]>([]);
  const [invalidReplays, setInvalidReplays] = useState<InvalidReplay[]>([]);
  const [gettingReplays, setGettingReplays] = useState(false);
  let hasRemainingReplays = false;
  const selectedReplays: Replay[] = [];
  replays.forEach((replay) => {
    if (replay.selected) {
      selectedReplays.push(replay);
      hasRemainingReplays = false;
    } else {
      hasRemainingReplays = true;
    }
  });
  const applyAllReplaysSelected = (allReplays: Replay[], selected: boolean) =>
    allReplays
      .filter((replay) => replay.invalidReasons.length === 0)
      .forEach((replay) => {
        replay.selected = selected;
      });
  const getNewBatchActives = (newReplays: Replay[]) => {
    const isPlayerArr =
      newReplays.length > 0
        ? newReplays
            .map((replay) =>
              replay.players.map(
                (player) => player.playerType === 0 || player.playerType === 1,
              ),
            )
            .reduce(
              (accArr, curArr) => [
                accArr[0] && curArr[0],
                accArr[1] && curArr[1],
                accArr[2] && curArr[2],
                accArr[3] && curArr[3],
              ],
              [true, true, true, true],
            )
        : [false, false, false, false];
    const teamIndiciesArr = [
      new Map<number, boolean>(),
      new Map<number, boolean>(),
      new Map<number, boolean>(),
      new Map<number, boolean>(),
    ];
    newReplays.forEach((replay) => {
      const teamIdsSeen: number[] = [];
      for (let i = 0; i < 4; i += 1) {
        const { teamId } = replay.players[i];
        if (teamId === 0 || teamId === 1 || teamId === 2) {
          const teamI = teamIdsSeen.indexOf(teamId);
          if (teamI === -1) {
            teamIndiciesArr[i].set(teamIdsSeen.length, true);
            teamIdsSeen.push(teamId);
          } else {
            teamIndiciesArr[i].set(teamI, true);
          }
        } else {
          teamIndiciesArr[i].set(-1, true);
        }
      }
    });
    const teamsConsistent = teamIndiciesArr.every(
      (teamIndicies) => teamIndicies.size === 1,
    );
    return isPlayerArr.map((isPlayer, i) => {
      return {
        active: teamsConsistent && isPlayer,
        teamI: teamsConsistent ? Array.from(teamIndiciesArr[i].keys())[0] : -1,
      };
    });
  };
  const [replayLoadCount, setReplayLoadCount] = useState(0);
  const copyControlsRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (scrollToBottom && copyControlsRef.current) {
      copyControlsRef.current.scrollIntoView(false);
    }
  }, [replayLoadCount, scrollToBottom]);
  const [skewDetected, setSkewDetected] = useState(false);
  const [skewDialogOpen, setSkewDialogOpen] = useState(false);
  const [wasDeleted, setWasDeleted] = useState(false);
  const chooseDir = async () => {
    setGettingReplays(true);
    const newDir = await window.electron.chooseReplaysDir();
    if (newDir && newDir !== dir) {
      const { replays: newReplays, invalidReplays: newInvalidReplays } =
        await window.electron.getReplaysInDir();
      applyAllReplaysSelected(newReplays, allReplaysSelected);
      setBatchActives(
        getNewBatchActives(newReplays.filter((replay) => replay.selected)),
      );
      setDir(newDir);
      setDirExists(true);
      setDirInit(false);
      resetOverrides();
      const skew = hasTimeSkew(newReplays);
      setSkewDetected(skew);
      if (skew) {
        setSkewDialogOpen(true);
      }
      setReplays(newReplays);
      setReplayLoadCount((r) => r + 1);
      setInvalidReplays(newInvalidReplays);
      if (newInvalidReplays.length > 0) {
        showErrorDialog(
          newInvalidReplays.map(
            (invalidReplay) =>
              `${invalidReplay.fileName}: ${invalidReplay.invalidReason}`,
          ),
        );
      }
      setWasDeleted(false);
    }
    setGettingReplays(false);
  };

  const setManualNamesOuter = async (names: string[]) => {
    setManualNames(names);
    await window.electron.setManualNames(names);
  };
  const [manualDialogOpen, setManualDialogOpen] = useState(false);

  const [guideState, setGuideState] = useState(GuideState.NONE);
  const [guideBackdropOpen, setGuideBackdropOpen] = useState(false);
  const [guidedDialogOpen, setGuidedDialogOpen] = useState(true);
  const [confirmedCopySettings, setConfirmedCopySettings] = useState(false);
  const tournamentSet =
    (mode === Mode.STARTGG && slug.length > 0) ||
    (mode === Mode.CHALLONGE && challongeTournaments.size > 0) ||
    (mode === Mode.MANUAL && manualNames.length > 0);
  const copyDirSet = copyDir.length > 0;
  const guideActive =
    guidedMode && tournamentSet && copyDirSet && confirmedCopySettings;
  const refreshReplays = useCallback(
    async (triggerGuide?: boolean) => {
      let newReplays: Replay[] = [];
      let newInvalidReplays: InvalidReplay[] = [];
      setGettingReplays(true);
      try {
        const res = await window.electron.getReplaysInDir();
        newReplays = res.replays;
        newInvalidReplays = res.invalidReplays;
        setDirExists(true);
        if (triggerGuide && newReplays.length > 0) {
          setGuideState(
            mode === Mode.MANUAL ? GuideState.PLAYERS : GuideState.SET,
          );
          if (guideActive) {
            setGuideBackdropOpen(true);
          }
        }
      } catch (e: any) {
        setDirExists(false);
        setGuideBackdropOpen(false);
        setGuideState(GuideState.NONE);
      }
      applyAllReplaysSelected(newReplays, allReplaysSelected);
      setBatchActives(
        getNewBatchActives(newReplays.filter((replay) => replay.selected)),
      );
      setDirInit(false);
      resetOverrides();
      const skew = hasTimeSkew(newReplays);
      setSkewDetected(skew);
      if (skew) {
        setSkewDialogOpen(true);
      }
      setReplays(newReplays);
      setReplayLoadCount((r) => r + 1);
      setInvalidReplays(newInvalidReplays);
      if (newInvalidReplays.length > 0) {
        showErrorDialog(
          newInvalidReplays.map(
            (invalidReplay) =>
              `${invalidReplay.fileName}: ${invalidReplay.invalidReason}`,
          ),
        );
      }
      setGettingReplays(false);
    },
    [allReplaysSelected, guideActive, mode],
  );
  const deleteDir = async () => {
    if (!dir) {
      return;
    }

    await window.electron.deleteReplaysDir();
    setWasDeleted(true);
    await refreshReplays();
  };
  const onPlayerOverride = () => {
    setReplays(Array.from(replays));
  };
  const onReplayClick = (index: number) => {
    const newReplays = Array.from(replays);
    newReplays[index].selected = !newReplays[index].selected;
    const newBatchActives = getNewBatchActives(
      newReplays.filter((replay) => replay.selected),
    );

    const newOverrides = Array.from(overrides);
    for (let i = 0; i < 4; i += 1) {
      if (batchActives[i].active && !newBatchActives[i].active) {
        newOverrides[i] = {
          displayName: '',
          entrantId: 0,
          prefix: '',
          pronouns: '',
        };
      }
    }

    if (newReplays[index].selected) {
      newReplays[index].players.forEach((player, i) => {
        player.playerOverrides = { ...newOverrides[i] };
      });
    } else {
      newReplays[index].players.forEach((player) => {
        player.playerOverrides = {
          displayName: '',
          entrantId: 0,
          prefix: '',
          pronouns: '',
        };
      });
    }

    setBatchActives(newBatchActives);
    setOverrides(newOverrides);
    setReplays(newReplays);
    resetDq();
  };
  useEffect(() => {
    window.electron.onTournament(
      (
        e,
        {
          selectedSet: newSelectedSet,
          startggTournament: newTournament,
          challongeTournaments: newChallongeTournaments,
        },
      ) => {
        if (newSelectedSet) {
          setSelectedSet(newSelectedSet);
        }
        if (newTournament) {
          if (tournamentSet && copyDirSet && confirmedCopySettings) {
            setGuideBackdropOpen(false);
          }
          setTournament(newTournament);
        }
        if (newChallongeTournaments) {
          if (tournamentSet && copyDirSet && confirmedCopySettings) {
            setGuideBackdropOpen(false);
          }
          setChallongeTournaments(newChallongeTournaments);
        }
      },
      selectedSet.id,
    );
  }, [confirmedCopySettings, copyDirSet, selectedSet, tournamentSet]);
  useEffect(() => {
    window.electron.onUsb((e, newDir) => {
      setDir(newDir);
      setWasDeleted(false);
      refreshReplays(true);
    });
  }, [refreshReplays]);

  const availablePlayers: PlayerOverrides[] = [];
  selectedSet.entrant1Participants.forEach((participant) => {
    availablePlayers.push({
      displayName: participant.displayName,
      entrantId: selectedSet.entrant1Id,
      prefix: participant.prefix,
      pronouns: participant.pronouns,
    });
  });
  selectedSet.entrant2Participants.forEach((participant) => {
    availablePlayers.push({
      displayName: participant.displayName,
      entrantId: selectedSet.entrant1Id,
      prefix: participant.prefix,
      pronouns: participant.pronouns,
    });
  });

  const [slugDialogOpen, setSlugDialogOpen] = useState(false);
  const [gettingTournament, setGettingTournament] = useState(false);
  const [searchSubstr, setSearchSubstr] = useState('');

  // Challonge tournament view
  const getChallongeTournament = async (maybeSlug: string) => {
    if (!maybeSlug) {
      return;
    }

    setGettingTournament(true);
    try {
      await window.electron.getChallongeTournament(maybeSlug);
    } catch (e: any) {
      showErrorDialog([e.toString()]);
    } finally {
      setGettingTournament(false);
    }
  };

  // start.gg tournament view
  const getPhaseGroup = async (id: number) => {
    try {
      await window.electron.getPhaseGroup(id);
    } catch (e: any) {
      showErrorDialog([e.toString()]);
    }
  };

  const findUnusedPlayer = (
    displayName: string,
    entrantId: number,
    prefix: string,
    pronouns: string,
    // Had problems using Set because we also import Set type in this file lol.
    overrideSet: Map<string, boolean>,
  ): PlayerOverrides => {
    const isEntrant1 = entrantId === selectedSet.entrant1Id;
    const isTeams = selectedSet.entrant1Participants.length > 1;
    let displayNameToCheck = '';
    let entrantIdToCheck = 0;
    let prefixToCheck = '';
    let pronounsToCheck = '';
    if (isEntrant1 && isTeams) {
      const participantToCheck = selectedSet.entrant1Participants.find(
        (participant) =>
          participant.displayName !== displayName ||
          participant.pronouns !== pronouns ||
          participant.prefix !== prefix,
      ) || { displayName, pronouns, prefix }; // two participants could have the exact same name/pronouns/prefix, I guess
      displayNameToCheck = participantToCheck.displayName;
      entrantIdToCheck = selectedSet.entrant1Id;
      prefixToCheck = participantToCheck.prefix;
      pronounsToCheck = participantToCheck.pronouns;
    } else if (!isEntrant1 && isTeams) {
      const participantToCheck = selectedSet.entrant2Participants.find(
        (participant) =>
          participant.displayName !== displayName ||
          participant.pronouns !== pronouns ||
          participant.prefix !== prefix,
      ) || { displayName, pronouns, prefix }; // two participants could have the exact same name/pronouns/prefix, I guess
      displayNameToCheck = participantToCheck.displayName;
      entrantIdToCheck = selectedSet.entrant2Id;
      prefixToCheck = participantToCheck.prefix;
      pronounsToCheck = participantToCheck.pronouns;
    } else if (isEntrant1 && !isTeams) {
      displayNameToCheck = selectedSet.entrant2Participants[0].displayName;
      entrantIdToCheck = selectedSet.entrant2Id;
      prefixToCheck = selectedSet.entrant2Participants[0].prefix;
      pronounsToCheck = selectedSet.entrant2Participants[0].pronouns;
    } else if (!isEntrant1 && !isTeams) {
      displayNameToCheck = selectedSet.entrant1Participants[0].displayName;
      entrantIdToCheck = selectedSet.entrant1Id;
      prefixToCheck = selectedSet.entrant1Participants[0].prefix;
      pronounsToCheck = selectedSet.entrant1Participants[0].pronouns;
    }
    if (
      !overrideSet.has(
        displayNameToCheck + entrantIdToCheck + prefixToCheck + pronounsToCheck,
      )
    ) {
      return {
        displayName: displayNameToCheck,
        entrantId: entrantIdToCheck,
        prefix: prefixToCheck,
        pronouns: pronounsToCheck,
      };
    }
    return { displayName: '', entrantId: 0, prefix: '', pronouns: '' };
  };

  // for click-assigning set participants
  const [selectedChipData, setSelectedChipData] = useState<PlayerOverrides>({
    displayName: '',
    entrantId: 0,
    prefix: '',
    pronouns: '',
  });
  const resetSelectedChipData = () => {
    setSelectedChipData({
      displayName: '',
      entrantId: 0,
      prefix: '',
      pronouns: '',
    });
  };

  // batch chips
  const onClickOrDrop = (
    displayName: string,
    entrantId: number,
    prefix: string,
    pronouns: string,
    index: number,
  ) => {
    const newOverrides = Array.from(overrides);
    newOverrides[index] = { displayName, entrantId, prefix, pronouns };
    newOverrides.forEach((override, i) => {
      if (
        i !== index &&
        override.displayName === displayName &&
        override.entrantId === entrantId
      ) {
        override.displayName = '';
        override.entrantId = 0;
      }
    });

    // pigeonhole remaining player if possible
    if (numBatchActive === availablePlayers.length) {
      const overrideSet = new Map<string, boolean>();
      const remainingIndices: number[] = [];
      const { teamI } = batchActives[index];
      const isTeams = availablePlayers.length === 4 && teamI !== -1;

      // find if there's exactly one hole to pigeon
      const batchActivesWithIndex = batchActives
        .map((batchActive, i) => ({
          active: batchActive.active,
          teamI: batchActive.teamI,
          i,
        }))
        .filter(
          (batchActiveWithIndex) =>
            batchActiveWithIndex.active &&
            (!isTeams || batchActiveWithIndex.teamI === teamI),
        );
      batchActivesWithIndex.forEach((batchActiveWithIndex) => {
        const { i } = batchActiveWithIndex;
        if (
          newOverrides[i].displayName === '' &&
          newOverrides[i].entrantId === 0
        ) {
          remainingIndices.push(i);
        } else {
          overrideSet.set(
            newOverrides[i].displayName +
              newOverrides[i].entrantId +
              newOverrides[i].prefix +
              newOverrides[i].pronouns,
            true,
          );
        }
      });

      // find the player to put in the hole
      if (remainingIndices.length === 1) {
        const unusedPlayer = findUnusedPlayer(
          displayName,
          entrantId,
          prefix,
          pronouns,
          overrideSet,
        );
        if (unusedPlayer.displayName && unusedPlayer.entrantId) {
          newOverrides[remainingIndices[0]] = unusedPlayer;
        }
      }
    }

    selectedReplays.forEach((replay) => {
      replay.players[index].playerOverrides = { ...newOverrides[index] };
      replay.players.forEach((otherPlayer) => {
        if (
          otherPlayer.port === replay.players[index].port ||
          (otherPlayer.playerType !== 0 && otherPlayer.playerType !== 1)
        ) {
          return;
        }
        if (
          otherPlayer.playerOverrides.displayName === displayName &&
          otherPlayer.playerOverrides.entrantId
        ) {
          otherPlayer.playerOverrides.displayName = '';
          otherPlayer.playerOverrides.entrantId = 0;
        }
      });
      for (let i = 0; i < 4; i += 1) {
        replay.players[i].playerOverrides = { ...newOverrides[i] };
      }
    });
    setOverrides(newOverrides);
    resetDq();
    resetSelectedChipData();
  };
  const batchChip = (index: number) => {
    const { active } = batchActives[index];
    return (
      <DroppableChip
        active={active}
        label={overrides[index].displayName || `P${index + 1} (all games)`}
        outlined={active}
        selectedChipData={selectedChipData}
        style={{ width: '25%' }}
        onClickOrDrop={(
          displayName: string,
          entrantId: number,
          prefix: string,
          pronouns: string,
        ) => onClickOrDrop(displayName, entrantId, prefix, pronouns, index)}
      />
    );
  };

  const getPhase = async (id: number, recursive: boolean = false) => {
    try {
      await window.electron.getPhase(id, recursive);
    } catch (e: any) {
      showErrorDialog([e.toString()]);
    }
  };

  const getEvent = async (id: number, recursive: boolean = false) => {
    try {
      await window.electron.getEvent(id, recursive);
    } catch (e: any) {
      showErrorDialog([e.toString()]);
    }
  };

  const getTournament = async (maybeSlug: string, initial: boolean = false) => {
    if (!maybeSlug) {
      return false;
    }

    setGettingTournament(true);
    try {
      await window.electron.getTournament(maybeSlug, initial && vlerkMode);
      if (slug !== maybeSlug) {
        setSelectedSet(EMPTY_SET);
        setSelectedSetChain(EMPTY_SELECTED_SET_CHAIN);
        await window.electron.setSelectedSetChain(0, 0, 0);
      }
      return true;
    } catch (e: any) {
      showErrorDialog([e.toString()]);
      return false;
    } finally {
      setGettingTournament(false);
    }
  };

  // set controls
  const selectSet = (set: Set) => {
    const newOverrides = [
      { displayName: '', entrantId: 0, prefix: '', pronouns: '' },
      { displayName: '', entrantId: 0, prefix: '', pronouns: '' },
      { displayName: '', entrantId: 0, prefix: '', pronouns: '' },
      { displayName: '', entrantId: 0, prefix: '', pronouns: '' },
    ];
    selectedReplays.forEach((replay) => {
      replay.players.forEach((player, i) => {
        player.playerOverrides = { ...newOverrides[i] };
      });
    });
    const newReplays = Array.from(replays);
    setSelectedSet(set);
    setOverrides(newOverrides);
    setReplays(newReplays);
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

  const [startingSet, setStartingSet] = useState(false);
  const startSet = async (setId: number | string) => {
    setStartingSet(true);
    try {
      if (mode === Mode.STARTGG) {
        await window.electron.startSet(setId);
      } else if (mode === Mode.CHALLONGE) {
        await window.electron.startChallongeSet(
          selectedChallongeTournament.slug,
          setId as number,
        );
      }
    } catch (e: any) {
      showErrorDialog([e.toString()]);
    } finally {
      setStartingSet(false);
    }
  };

  const reportStartggSet = async (set: StartggSet, update: boolean) => {
    const updatedSet = update
      ? await window.electron.updateSet(set)
      : await window.electron.reportSet(set);
    resetDq();
    return updatedSet;
  };
  const reportChallongeSet = async (
    matchId: number,
    items: ChallongeMatchItem[],
  ) => {
    const updatedSet = await window.electron.reportChallongeSet(
      selectedChallongeTournament.slug,
      matchId,
      items,
    );
    resetDq();
    return updatedSet;
  };

  // copy
  type NameObj = {
    characterName: string;
    displayName: string;
    nametag: string;
  };
  type NamesObj = {
    characterNames: Map<string, number>;
    displayName: string;
    nametags: Map<string, number>;
  };

  const [isCopying, setIsCopying] = useState(false);
  const [copyError, setCopyError] = useState('');
  const [copyErrorDialogOpen, setCopyErrorDialogOpen] = useState(false);
  const [copySuccess, setCopySuccess] = useState('');

  const onCopy = async (set?: Set, violatorDisplayNames?: string[]) => {
    setIsCopying(true);
    const copySet = set ?? selectedSet;

    let offsetMs = 0;
    const timeableReplays = selectedReplays.filter((replay) => replay.startAt);
    let startDate =
      timeableReplays.length > 0 ? timeableReplays[0].startAt! : new Date();
    if (copySettings.writeStartTimes && timeableReplays.length > 0) {
      const lastReplay = timeableReplays[timeableReplays.length - 1];
      const lastStartMs = lastReplay.startAt!.getTime();
      offsetMs =
        Date.now() -
        lastStartMs -
        Math.round((lastReplay.lastFrame + 124) / frameMsDivisor);
      startDate = new Date(timeableReplays[0].startAt!.getTime() + offsetMs);
    }

    let fileNames = selectedReplays.map((replay) => replay.fileName);
    let subdir = '';
    let context: Context | undefined;
    if (
      copySettings.writeFileNames ||
      copySettings.output === Output.FOLDER ||
      copySettings.output === Output.ZIP
    ) {
      const nameObjs = selectedReplays.map((replay) =>
        replay.players.map(
          (player): NameObj =>
            player.playerType === 0 || player.playerType === 1
              ? {
                  characterName: characterNames.get(
                    player.externalCharacterId,
                  )!,
                  displayName:
                    player.playerOverrides.displayName || player.displayName,
                  nametag: player.nametag,
                }
              : { characterName: '', displayName: '', nametag: '' },
        ),
      );

      const toPlayerOnly = (nameObj: NameObj) => {
        if (nameObj.displayName) {
          return nameObj.displayName;
        }
        if (nameObj.nametag) {
          return nameObj.nametag;
        }
        return nameObj.characterName;
      };
      const toPlayerChar = (nameObj: NameObj) => {
        if (nameObj.displayName) {
          return `${nameObj.displayName} (${nameObj.characterName})`;
        }
        if (nameObj.nametag) {
          return `${nameObj.characterName} (${nameObj.nametag})`;
        }
        return nameObj.characterName;
      };

      let roundShort = '';
      const regex = /([A-Z]|[0-9])/g;
      let regexRes = regex.exec(copySet.fullRoundText);
      while (regexRes) {
        roundShort += regexRes[0];
        regexRes = regex.exec(copySet.fullRoundText);
      }
      const roundLong = String(copySet.fullRoundText);
      if (
        copySettings.output === Output.FOLDER ||
        copySettings.output === Output.ZIP
      ) {
        const combinedNameObjs = nameObjs
          .reduce(
            (namesObj, game): NamesObj[] => {
              game.forEach((nameObj, i) => {
                if (nameObj.characterName) {
                  namesObj[i].displayName = nameObj.displayName;

                  const charCount =
                    namesObj[i].characterNames.get(nameObj.characterName) || 0;
                  namesObj[i].characterNames.set(
                    nameObj.characterName,
                    charCount + 1,
                  );

                  const nameCount =
                    namesObj[i].nametags.get(nameObj.nametag) || 0;
                  namesObj[i].nametags.set(nameObj.nametag, nameCount + 1);
                }
              });
              return namesObj;
            },
            [
              {
                characterNames: new Map(),
                displayName: '',
                nametags: new Map(),
              },
              {
                characterNames: new Map(),
                displayName: '',
                nametags: new Map(),
              },
              {
                characterNames: new Map(),
                displayName: '',
                nametags: new Map(),
              },
              {
                characterNames: new Map(),
                displayName: '',
                nametags: new Map(),
              },
            ],
          )
          .map((namesObj) => ({
            displayName: namesObj.displayName,
            characterName: [...namesObj.characterNames.entries()]
              .sort(
                (entryA: [string, number], entryB: [string, number]) =>
                  entryB[1] - entryA[1],
              )
              .map((entry) => entry[0])
              .join(', '),
            nametag: [...namesObj.nametags.entries()]
              .sort(
                (entryA: [string, number], entryB: [string, number]) =>
                  entryB[1] - entryA[1],
              )
              .map((entry) => entry[0])
              .join(', '),
          }))
          .filter((nameObj) => nameObj.characterName);
        const playersOnly = combinedNameObjs.map(toPlayerOnly).join(', ');
        const playersChars = combinedNameObjs.map(toPlayerChar).join(', ');
        const singlesChars =
          combinedNameObjs.length === 4 ? playersOnly : playersChars;
        subdir = String(folderNameFormat);
        subdir = subdir.replace('{date}', format(startDate, 'yyyyMMdd'));
        subdir = subdir.replace('{time}', format(startDate, 'HHmm'));
        subdir = subdir.replace('{roundShort}', roundShort);
        subdir = subdir.replace('{roundLong}', roundLong);
        subdir = subdir.replace('{games}', selectedReplays.length.toString(10));
        // do last in case event/phase/phase group names contain template strings LOL
        if (mode === Mode.STARTGG) {
          subdir = subdir.replace(
            '{event}',
            selectedSetChain.event?.name ?? '',
          );
          subdir = subdir.replace(
            '{phase}',
            selectedSetChain.phase?.name ?? '',
          );
          subdir = subdir.replace(
            '{phaseGroup}',
            selectedSetChain.phaseGroup?.name ?? '',
          );
        }
        // do last in case player names contain template strings LOL
        subdir = subdir.replace('{playersOnly}', playersOnly);
        subdir = subdir.replace('{playersChars}', playersChars);
        subdir = subdir.replace('{singlesChars}', singlesChars);
      }

      if (copySettings.writeFileNames) {
        fileNames = nameObjs.map((game, i) => {
          const { stageId, startAt } = selectedReplays[i];
          let writeStartDate = null;
          if (startAt) {
            writeStartDate = copySettings.writeStartTimes
              ? new Date(startAt.getTime() + offsetMs)
              : startAt;
          }
          const names = game.filter((nameObj) => nameObj.characterName);
          const playersOnly = names.map(toPlayerOnly).join(', ');
          const playersChars = names.map(toPlayerChar).join(', ');
          const singlesChars =
            nameObjs.length === 4 ? playersOnly : playersChars;

          let fileName = String(fileNameFormat);
          fileName = fileName.replace(
            '{date}',
            writeStartDate ? format(writeStartDate, 'yyyyMMdd') : '',
          );
          fileName = fileName.replace(
            '{time}',
            writeStartDate ? format(writeStartDate, 'HHmmss') : '',
          );
          fileName = fileName.replace('{roundShort}', roundShort);
          fileName = fileName.replace('{roundLong}', roundLong);
          fileName = fileName.replace('{stage}', stageNames.get(stageId) || '');
          fileName = fileName.replace('{ordinal}', (i + 1).toString(10));
          // do last in case player names contain template strings LOL
          fileName = fileName.replace('{playersOnly}', playersOnly);
          fileName = fileName.replace('{playersChars}', playersChars);
          fileName = fileName.replace('{singlesChars}', singlesChars);
          return `${fileName}.slp`;
        });
      }

      if (copySettings.writeContext) {
        let canWriteContext = true;
        const scores: ContextScore[] = [];
        const gameScores = [0, 0];
        selectedReplays.forEach((replay) => {
          const slots: ContextSlot[] = [];
          const usedK = new Map<number, boolean>();
          for (let j = 0; j < 2; j += 1) {
            slots[j] = {
              displayNames: [],
              ports: [],
              prefixes: [],
              pronouns: [],
              score: gameScores[j],
            };
            let teamId: number | undefined;
            for (let k = 0; k < replay.players.length; k += 1) {
              const player = replay.players[k];
              if (
                (player.playerType === 0 || player.playerType === 1) &&
                !usedK.has(k) &&
                (teamId === undefined || teamId === player.teamId)
              ) {
                const displayName =
                  player.playerOverrides.displayName || player.displayName;
                if (!displayName) {
                  canWriteContext = false;
                }
                slots[j].displayNames.push(displayName);
                slots[j].ports.push(player.port);
                slots[j].prefixes.push(player.playerOverrides.prefix);
                slots[j].pronouns.push(player.playerOverrides.pronouns);
                if (player.isWinner) {
                  gameScores[j] += 1;
                }
                usedK.set(k, true);
                if (replay.isTeams) {
                  if (teamId === undefined) {
                    teamId = player.teamId;
                  }
                } else {
                  break;
                }
              }
            }
          }
          scores.push({ slots: [slots[0], slots[1]] });
        });
        const lastScore = scores[scores.length - 1];
        const finalScore: ContextScore = {
          slots: [
            {
              displayNames: lastScore.slots[0].displayNames,
              ports: lastScore.slots[0].ports,
              prefixes: lastScore.slots[0].prefixes,
              pronouns: lastScore.slots[0].pronouns,
              score: gameScores[0],
            },
            {
              displayNames: lastScore.slots[1].displayNames,
              ports: lastScore.slots[1].ports,
              prefixes: lastScore.slots[1].prefixes,
              pronouns: lastScore.slots[1].pronouns,
              score: gameScores[1],
            },
          ],
        };
        if (canWriteContext) {
          context = {
            bestOf: Math.max(gameScores[0], gameScores[1]) * 2 - 1,
            durationMs: selectedReplays
              .map((replay) =>
                Math.ceil((replay.lastFrame + 124) / frameMsDivisor),
              )
              .reduce((prev, curr) => prev + curr, 0),
            scores,
            finalScore,
            startMs: startDate.getTime(),
          };

          if (copySet.id) {
            if (mode === Mode.STARTGG) {
              context.startgg = {
                tournament: {
                  name: tournament.name,
                  location: tournament.location,
                },
                event: selectedSetChain.event!,
                phase: selectedSetChain.phase!,
                phaseGroup: selectedSetChain.phaseGroup!,
                set: {
                  id:
                    typeof copySet.id === 'string' ||
                    (Number.isInteger(copySet.id) && copySet.id > 0)
                      ? copySet.id
                      : undefined,
                  fullRoundText: copySet.fullRoundText,
                  ordinal: copySet.ordinal,
                  round: copySet.round,
                  stream: copySet.stream,
                },
              };
            } else if (mode === Mode.CHALLONGE) {
              context.challonge = {
                tournament: {
                  name: selectedChallongeTournament.name,
                  slug: selectedChallongeTournament.slug,
                  tournamentType: selectedChallongeTournament.tournamentType,
                },
                set: {
                  id:
                    Number.isInteger(copySet.id) && (copySet.id as number) > 0
                      ? (copySet.id as number)
                      : undefined,
                  fullRoundText: copySet.fullRoundText,
                  ordinal: copySet.ordinal,
                  round: copySet.round,
                  stream: copySet.stream,
                },
              };
            }
          }
        }
      }
    }

    let startTimes: string[] = [];
    if (copySettings.writeStartTimes) {
      startTimes = selectedReplays.map((replay) =>
        replay.startAt
          ? new Date(replay.startAt.getTime() + offsetMs).toISOString()
          : '',
      );
    }

    try {
      await window.electron.writeReplays(
        copyDir,
        fileNames,
        copySettings.output,
        selectedReplays,
        startTimes,
        subdir,
        copySettings.writeDisplayNames,
        context,
      );
      if (violatorDisplayNames && violatorDisplayNames.length > 0) {
        const vsStr = `${copySet.entrant1Participants
          .map((participant) => participant.displayName)
          .join('/')} vs ${copySet.entrant2Participants
          .map((participant) => participant.displayName)
          .join('/')}`;
        await window.electron.appendEnforcerResult(
          violatorDisplayNames
            .map(
              (displayName) =>
                `${displayName},${format(startDate, 'HH:mm')},${
                  copySet.fullRoundText
                },${vsStr}`,
            )
            .join('\n')
            .concat('\n'),
        );
      }
      setCopySuccess('Success!');
      setTimeout(() => setCopySuccess(''), 5000);
    } finally {
      setIsCopying(false);
    }
  };

  return (
    <>
      <AppBar position="fixed" style={{ backgroundColor: 'white' }}>
        <Toolbar disableGutters variant="dense">
          <AppBarSection flexGrow={1} minWidth={600}>
            <Stack alignItems="center" direction="row">
              <Tooltip
                arrow
                title={
                  allReplaysSelected
                    ? 'Deselect all replays'
                    : 'Select all replays'
                }
              >
                <Checkbox
                  checked={allReplaysSelected}
                  onClick={() => {
                    const newAllReplaysSelected = !allReplaysSelected;
                    setAllReplaysSelected(newAllReplaysSelected);
                    applyAllReplaysSelected(replays, newAllReplaysSelected);
                    replays.forEach((replay) => {
                      replay.players.forEach((player) => {
                        player.playerOverrides = {
                          displayName: '',
                          entrantId: 0,
                          prefix: '',
                          pronouns: '',
                        };
                      });
                    });
                    resetOverrides();
                    setBatchActives(
                      getNewBatchActives(
                        replays.filter((replay) => replay.selected),
                      ),
                    );
                    setReplays(Array.from(replays));
                  }}
                />
              </Tooltip>
              <InputBase
                disabled
                size="small"
                value={dir || 'Set replays folder...'}
                style={{ flexGrow: 1 }}
              />
              {dir &&
                dirExists &&
                !gettingReplays &&
                (replays.length > 0 || invalidReplays.length > 0) && (
                  <>
                    <Tooltip arrow title="Delete replays folder and eject">
                      <IconButton onClick={() => setDirDeleteDialogOpen(true)}>
                        <DeleteForeverOutlined />
                      </IconButton>
                    </Tooltip>
                    <Dialog
                      open={dirDeleteDialogOpen}
                      onClose={() => {
                        setDirDeleteDialogOpen(false);
                      }}
                    >
                      <DialogTitle>Delete Replays Folder?</DialogTitle>
                      <DialogContent>
                        <Alert severity="warning">
                          {replays.length} replays will be deleted! (And the
                          drive will be ejected if applicable)
                        </Alert>
                      </DialogContent>
                      <DialogActions>
                        <Button
                          disabled={dirDeleting}
                          endIcon={
                            dirDeleting ? (
                              <CircularProgress size="24px" />
                            ) : (
                              <DeleteForever />
                            )
                          }
                          onClick={async () => {
                            setDirDeleting(true);
                            try {
                              await deleteDir();
                              setGuideState(GuideState.NONE);
                            } catch (e: any) {
                              showErrorDialog([
                                e instanceof Error ? e.message : e,
                              ]);
                            } finally {
                              setDirDeleteDialogOpen(false);
                              setDirDeleting(false);
                            }
                          }}
                          variant="contained"
                        >
                          Delete
                        </Button>
                      </DialogActions>
                    </Dialog>
                  </>
                )}
              {dir && !gettingReplays && (
                <Tooltip arrow title="Refresh replays">
                  <IconButton onClick={() => refreshReplays()}>
                    <Refresh />
                  </IconButton>
                </Tooltip>
              )}
              {gettingReplays ? (
                <CircularProgress size="24px" style={{ margin: '9px' }} />
              ) : (
                <Tooltip arrow title="Set replays folder">
                  <IconButton onClick={chooseDir}>
                    <FolderOpen />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
          </AppBarSection>
          <Divider
            flexItem
            orientation="vertical"
            style={{ marginTop: 8, marginBottom: 8 }}
          />
          <AppBarSection width={300}>
            {mode === Mode.STARTGG && (
              <Stack direction="row">
                <InputBase
                  disabled
                  size="small"
                  value={slug || 'Set start.gg tournament...'}
                  style={{ flexGrow: 1 }}
                />
                <Tooltip arrow title="Refresh tournament and all descendants">
                  <div>
                    <IconButton
                      disabled={gettingTournament}
                      onClick={() => getTournament(slug)}
                    >
                      {gettingTournament ? (
                        <CircularProgress size="24px" />
                      ) : (
                        <Refresh />
                      )}
                    </IconButton>
                  </div>
                </Tooltip>
                <Tooltip arrow title="Set start.gg tournament">
                  <IconButton
                    aria-label="Set start.gg tournament"
                    onClick={() => setSlugDialogOpen(true)}
                  >
                    <Edit />
                  </IconButton>
                </Tooltip>
                <Dialog
                  open={slugDialogOpen}
                  onClose={() => {
                    setSlugDialogOpen(false);
                  }}
                >
                  <StartggTournamentForm
                    gettingAdminedTournaments={gettingAdminedTournaments}
                    adminedTournaments={adminedTournaments}
                    gettingTournament={gettingTournament}
                    getAdminedTournaments={async () => {
                      setGettingAdminedTournaments(true);
                      try {
                        setAdminedTournaments(
                          await window.electron.getTournaments(),
                        );
                      } catch (e: unknown) {
                        showErrorDialog([
                          `Unable to fetch admined tournaments: ${
                            e instanceof Error ? e.message : e
                          }`,
                        ]);
                      }
                      setGettingAdminedTournaments(false);
                    }}
                    getTournament={getTournament}
                    setSlug={setSlug}
                    close={() => {
                      setSlugDialogOpen(false);
                    }}
                  />
                </Dialog>
              </Stack>
            )}
            {mode === Mode.CHALLONGE && (
              <Stack direction="row">
                <InputBase
                  disabled
                  size="small"
                  value="Add Challonge tournament..."
                  style={{ flexGrow: 1 }}
                />
                <Tooltip arrow title="Add Challonge tournament">
                  <IconButton
                    aria-label="Add Challonge tournament"
                    onClick={() => setSlugDialogOpen(true)}
                  >
                    <Edit />
                  </IconButton>
                </Tooltip>
                <Dialog
                  open={slugDialogOpen}
                  onClose={() => {
                    setSlugDialogOpen(false);
                  }}
                >
                  <ChallongeTournamentForm
                    gettingAdminedTournaments={gettingAdminedTournaments}
                    adminedTournaments={adminedTournaments}
                    gettingTournament={gettingTournament}
                    getAdminedTournaments={async () => {
                      setGettingAdminedTournaments(true);
                      try {
                        setAdminedTournaments(
                          await window.electron.getTournaments(),
                        );
                      } catch (e: unknown) {
                        showErrorDialog([
                          `Unable to fetch admined tournaments: ${
                            e instanceof Error ? e.message : e
                          }`,
                        ]);
                      }
                      setGettingAdminedTournaments(false);
                    }}
                    getTournament={getChallongeTournament}
                    close={() => {
                      setSlugDialogOpen(false);
                    }}
                  />
                </Dialog>
              </Stack>
            )}
            {mode === Mode.MANUAL && (
              <ManualBar
                manualDialogOpen={manualDialogOpen}
                setManualDialogOpen={setManualDialogOpen}
                manualNames={manualNames}
                setManualNames={setManualNamesOuter}
              />
            )}
          </AppBarSection>
        </Toolbar>
      </AppBar>
      <TopColumns
        direction="row"
        divider={<Divider flexItem orientation="vertical" />}
        spacing="8px"
      >
        <TopColumn flexGrow={1} minWidth="600px">
          {dir &&
            (dirExists ? (
              <>
                <ReplayList
                  dirInit={dirInit}
                  numAvailablePlayers={availablePlayers.length}
                  replays={replays}
                  selectedChipData={selectedChipData}
                  findUnusedPlayer={findUnusedPlayer}
                  onClick={onReplayClick}
                  onOverride={onPlayerOverride}
                  resetSelectedChipData={resetSelectedChipData}
                  elevate={
                    guideActive &&
                    guideBackdropOpen &&
                    guideState === GuideState.REPLAYS
                  }
                  elevateChips={
                    guideActive &&
                    guideBackdropOpen &&
                    guideState === GuideState.PLAYERS &&
                    numBatchActive !== 2 &&
                    numBatchActive !== 4
                  }
                  elevateNames={
                    guideActive &&
                    guideBackdropOpen &&
                    guideState === GuideState.PLAYERS
                  }
                />
                <Dialog
                  open={skewDialogOpen}
                  onClose={() => {
                    setSkewDialogOpen(false);
                  }}
                >
                  <DialogTitle>
                    {skewDetected
                      ? 'Large time gap detected!'
                      : 'Re-order replays'}
                  </DialogTitle>
                  <DialogContent>
                    {replays.map((replay, i) => (
                      <ListItem key={replay.fileName} disableGutters>
                        <Stack alignItems="center" direction="row" gap="8px">
                          <SkewReplay replay={replay} />
                          {i === 0 ? (
                            <Tooltip placement="left" title="First">
                              <div style={{ height: '40px', width: '40px' }} />
                            </Tooltip>
                          ) : (
                            <Tooltip placement="left" title="Move up">
                              <IconButton
                                onClick={() => {
                                  const arr = [...replays];
                                  [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
                                  setReplays(arr);
                                }}
                              >
                                <ArrowUpward />
                              </IconButton>
                            </Tooltip>
                          )}
                          {i === replays.length - 1 ? (
                            <Tooltip placement="right" title="Last">
                              <div style={{ height: '40px', width: '40px' }} />
                            </Tooltip>
                          ) : (
                            <Tooltip placement="right" title="Move down">
                              <IconButton
                                onClick={() => {
                                  const arr = [...replays];
                                  [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
                                  setReplays(arr);
                                }}
                              >
                                <ArrowDownward />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Stack>
                      </ListItem>
                    ))}
                  </DialogContent>
                  <DialogActions>
                    <Button
                      variant="contained"
                      onClick={() => {
                        for (let i = replays.length - 1; i > 0; i -= 1) {
                          const firstMs = replays[i - 1].startAt!.getTime();
                          const secondMs = replays[i].startAt!.getTime();
                          if (
                            firstMs > secondMs ||
                            secondMs - firstMs > 3600000
                          ) {
                            const durationMs = Math.ceil(
                              (replays[i - 1].lastFrame + 124) / frameMsDivisor,
                            );
                            replays[i - 1].startAt = new Date(
                              secondMs - durationMs,
                            );
                          }
                        }
                        setReplays([...replays]);
                        setSkewDialogOpen(false);
                      }}
                    >
                      Fix!
                    </Button>
                  </DialogActions>
                </Dialog>
                <GlobalHotKeys
                  keyMap={{
                    SKEW: window.electron.isMac ? 'command+t' : 'ctrl+t',
                  }}
                  handlers={{
                    SKEW: () => {
                      setSkewDialogOpen(true);
                    },
                  }}
                />
              </>
            ) : (
              <Alert
                severity={wasDeleted ? 'warning' : 'error'}
                sx={{ mb: '8px', pl: '24px' }}
              >
                {wasDeleted
                  ? 'Replays folder deleted.'
                  : 'Replays folder not found.'}
              </Alert>
            ))}
          <div ref={copyControlsRef} />
          <CopyControls
            dir={copyDir}
            setDir={setCopyDir}
            error={copyError}
            setError={setCopyError}
            errorDialogOpen={copyErrorDialogOpen}
            setErrorDialogOpen={setCopyErrorDialogOpen}
            hasSelectedReplays={selectedReplays.length > 0}
            isCopying={isCopying}
            onCopy={onCopy}
            success={copySuccess}
            copySettings={copySettings}
            setCopySettings={async (newCopySettings: CopySettings) => {
              await window.electron.setCopySettings(newCopySettings);
              setCopySettings(newCopySettings);
            }}
            elevateSettings={
              guidedMode &&
              guideBackdropOpen &&
              tournamentSet &&
              copyDirSet &&
              !confirmedCopySettings
            }
          />
        </TopColumn>
        <TopColumn
          width="300px"
          sx={{
            zIndex: (theme) =>
              guideActive &&
              guideBackdropOpen &&
              (guideState === GuideState.SET ||
                (mode === Mode.MANUAL && guideState === GuideState.PLAYERS))
                ? theme.zIndex.drawer + 2
                : undefined,
          }}
        >
          <SearchBox
            mode={mode}
            searchSubstr={searchSubstr}
            setSearchSubstr={setSearchSubstr}
            vlerkMode={vlerkMode}
          />
          {mode === Mode.STARTGG && (
            <StartggView
              searchSubstr={searchSubstr}
              tournament={tournament}
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
            Array.from(challongeTournaments.values()).map(
              (challongeTournament) => (
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
              ),
            )}
          {mode === Mode.MANUAL && (
            <ManualView
              manualNames={manualNames}
              searchSubstr={searchSubstr}
              selectedChipData={selectedChipData}
              setSelectedChipData={setSelectedChipData}
            />
          )}
        </TopColumn>
      </TopColumns>
      <Bottom elevation={3}>
        <BottomColumns
          direction="row"
          divider={<Divider flexItem orientation="vertical" />}
          spacing="8px"
        >
          <Stack
            boxSizing="border-box"
            flexGrow={1}
            minWidth="600px"
            padding="20px 0 0 42px"
          >
            <Stack direction="row">
              {batchChip(0)}
              {batchChip(1)}
              {batchChip(2)}
              {batchChip(3)}
            </Stack>
            {autoDetectUsb && guidedMode ? (
              <GuidedDialog
                open={guidedDialogOpen}
                setOpen={setGuidedDialogOpen}
                mode={mode}
                gettingAdminedTournaments={gettingAdminedTournaments}
                adminedTournaments={adminedTournaments}
                getAdminedTournaments={async () => {
                  setGettingAdminedTournaments(true);
                  try {
                    setAdminedTournaments(
                      await window.electron.getTournaments(),
                    );
                  } catch (e: unknown) {
                    showErrorDialog([
                      `Unable to fetch admined tournaments: ${
                        e instanceof Error ? e.message : e
                      }`,
                    ]);
                  }
                  setGettingAdminedTournaments(false);
                }}
                gettingTournament={gettingTournament}
                tournamentSet={tournamentSet}
                copyDirSet={copyDirSet}
                setStartggTournamentSlug={setSlug}
                getStartggTournament={getTournament}
                getChallongeTournament={getChallongeTournament}
                manualNames={manualNames}
                setManualNames={setManualNamesOuter}
                copyDir={copyDir}
                setCopyDir={setCopyDir}
                confirmedCopySettings={confirmedCopySettings}
                setConfirmedCopySettings={setConfirmedCopySettings}
                state={guideState}
                setState={setGuideState}
                backdropOpen={guideBackdropOpen}
                setBackdropOpen={setGuideBackdropOpen}
              />
            ) : (
              <Stack
                alignItems="center"
                direction="row"
                flexGrow={1}
                justifyContent="right"
                marginTop="8px"
                spacing="1em"
              >
                <Stack>
                  <Typography variant="body2">
                    1. Set replay folder and tournament slug
                  </Typography>
                  <Typography variant="body2">
                    3. Drag and drop (or select and assign) players
                  </Typography>
                </Stack>
                <Stack>
                  <Typography variant="body2">
                    2. Select replays and set
                  </Typography>
                  <Typography variant="body2">
                    4. Copy replays / Report set
                  </Typography>
                </Stack>
              </Stack>
            )}
          </Stack>
          <Stack justifyContent="space-between" width="300px">
            <Stack>
              {selectedSet.id !== 0 && (
                <>
                  <Stack
                    alignItems="center"
                    justifyContent="center"
                    direction="row"
                  >
                    <Typography lineHeight="20px" variant="caption">
                      {selectedSet.fullRoundText}
                      {(typeof selectedSet.id === 'string' ||
                        (Number.isInteger(selectedSet.id) &&
                          selectedSet.id > 0)) &&
                        ` (${selectedSet.id})`}
                    </Typography>
                    {selectedSet.state === State.STARTED && (
                      <>
                        &nbsp;
                        <Tooltip title="Started">
                          <HourglassTop fontSize="inherit" />
                        </Tooltip>
                      </>
                    )}
                    {selectedSet.state === State.COMPLETED && (
                      <>
                        &nbsp;
                        <Tooltip placement="top" title="Finished">
                          <Backup fontSize="inherit" />
                        </Tooltip>
                      </>
                    )}
                  </Stack>
                  <Tooltip arrow title="Click or drag!">
                    <Stack direction="row" gap="8px">
                      <Stack gap="8px" width="50%">
                        <DraggableChip
                          entrantId={selectedSet.entrant1Id}
                          nameWithHighlight={{
                            name: selectedSet.entrant1Participants[0]
                              .displayName,
                          }}
                          prefix={selectedSet.entrant1Participants[0].prefix}
                          pronouns={
                            selectedSet.entrant1Participants[0].pronouns
                          }
                          selectedChipData={selectedChipData}
                          setSelectedChipData={setSelectedChipData}
                          elevate={
                            guideActive &&
                            guideBackdropOpen &&
                            guideState === GuideState.PLAYERS
                          }
                        />
                        {selectedSet.entrant1Participants.length > 1 && (
                          <DraggableChip
                            entrantId={selectedSet.entrant1Id}
                            nameWithHighlight={{
                              name: selectedSet.entrant1Participants[1]
                                .displayName,
                            }}
                            prefix={selectedSet.entrant1Participants[1].prefix}
                            pronouns={
                              selectedSet.entrant1Participants[1].pronouns
                            }
                            selectedChipData={selectedChipData}
                            setSelectedChipData={setSelectedChipData}
                            elevate={
                              guideActive &&
                              guideBackdropOpen &&
                              guideState === GuideState.PLAYERS
                            }
                          />
                        )}
                      </Stack>
                      <Stack gap="8px" width="50%">
                        <DraggableChip
                          entrantId={selectedSet.entrant2Id}
                          nameWithHighlight={{
                            name: selectedSet.entrant2Participants[0]
                              .displayName,
                          }}
                          prefix={selectedSet.entrant2Participants[0].prefix}
                          pronouns={
                            selectedSet.entrant2Participants[0].pronouns
                          }
                          selectedChipData={selectedChipData}
                          setSelectedChipData={setSelectedChipData}
                          elevate={
                            guideActive &&
                            guideBackdropOpen &&
                            guideState === GuideState.PLAYERS
                          }
                        />
                        {selectedSet.entrant2Participants.length > 1 && (
                          <DraggableChip
                            entrantId={selectedSet.entrant2Id}
                            nameWithHighlight={{
                              name: selectedSet.entrant2Participants[1]
                                .displayName,
                            }}
                            prefix={selectedSet.entrant2Participants[1].prefix}
                            pronouns={
                              selectedSet.entrant2Participants[1].pronouns
                            }
                            selectedChipData={selectedChipData}
                            setSelectedChipData={setSelectedChipData}
                            elevate={
                              guideActive &&
                              guideBackdropOpen &&
                              guideState === GuideState.PLAYERS
                            }
                          />
                        )}
                      </Stack>
                    </Stack>
                  </Tooltip>
                </>
              )}
            </Stack>
            <Stack
              direction="row"
              justifyContent="flex-end"
              paddingTop="8px"
              spacing="8px"
            >
              <Tooltip title="Start set">
                <div>
                  <IconButton
                    color="primary"
                    disabled={
                      !(
                        (typeof selectedSet.id === 'string' ||
                          (Number.isInteger(selectedSet.id) &&
                            selectedSet.id > 0)) &&
                        (selectedSet.state === State.PENDING ||
                          selectedSet.state === State.CALLED)
                      ) || startingSet
                    }
                    size="small"
                    onClick={() => startSet(selectedSet.id)}
                  >
                    {startingSet ? (
                      <CircularProgress size="24px" />
                    ) : (
                      <HourglassTop />
                    )}
                  </IconButton>
                </div>
              </Tooltip>
              <ManualReport
                mode={mode}
                reportChallongeSet={reportChallongeSet}
                reportStartggSet={reportStartggSet}
                selectedSet={selectedSet}
              />
              <SetControls
                mode={mode}
                copyReplays={onCopy}
                deleteReplays={deleteDir}
                reportChallongeSet={reportChallongeSet}
                reportStartggSet={reportStartggSet}
                setReportSettings={async (
                  newReportSettings: ReportSettings,
                ) => {
                  await window.electron.setReportSettings(newReportSettings);
                  setReportSettings(newReportSettings);
                }}
                resetGuide={() => {
                  setGuideState(GuideState.NONE);
                  setGuideBackdropOpen(false);
                }}
                copyDisabled={
                  isCopying || !copyDir || selectedReplays.length === 0
                }
                dqId={dq.entrantId}
                hasRemainingReplays={hasRemainingReplays}
                reportSettings={reportSettings}
                selectedReplays={selectedReplays}
                set={selectedSet}
                useEnforcer={useEnforcer}
                vlerkMode={vlerkMode}
                elevate={
                  guideActive &&
                  guideBackdropOpen &&
                  guideState === GuideState.PLAYERS
                }
              />
            </Stack>
          </Stack>
        </BottomColumns>
      </Bottom>
      <Backdrop
        onClick={resetSelectedChipData}
        open={!!(selectedChipData.displayName && selectedChipData.entrantId)}
        sx={{ zIndex: (theme) => theme.zIndex.drawer + 3 }}
      />
      <Backdrop
        onClick={() => setGuideBackdropOpen(false)}
        open={guidedMode && guideBackdropOpen}
        sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}
      />
      <ErrorDialog
        messages={errors}
        onClose={() => {
          setErrors([]);
          setErrorDialogOpen(false);
        }}
        open={errorDialogOpen}
      />
      <Settings
        appVersion={appVersion}
        latestAppVersion={latestAppVersion}
        gotSettings={gotSettings}
        mode={mode}
        setMode={async (newMode: Mode) => {
          setMode(newMode);
          setSelectedSet(EMPTY_SET);
          setSelectedSetChain(EMPTY_SELECTED_SET_CHAIN);
          setSelectedChallongeTournament({
            name: '',
            slug: '',
            tournamentType: '',
          });
          await window.electron.setSelectedSetChain(0, 0, 0);
          await window.electron.setSelectedChallongeTournament('');
        }}
        startggApiKey={startggApiKey}
        setStartggApiKey={setStartggApiKey}
        challongeApiKey={challongeApiKey}
        setChallongeApiKey={setChallongeApiKey}
        autoDetectUsb={autoDetectUsb}
        setAutoDetectUsb={setAutoDetectUsb}
        scrollToBottom={scrollToBottom}
        setScrollToBottom={setScrollToBottom}
        useEnforcer={useEnforcer}
        setUseEnforcer={setUseEnforcer}
        vlerkMode={vlerkMode}
        setVlerkMode={setVlerkMode}
        guidedMode={guidedMode}
        setGuidedMode={setGuidedMode}
        fileNameFormat={fileNameFormat}
        setFileNameFormat={setFileNameFormat}
        folderNameFormat={folderNameFormat}
        setFolderNameFormat={setFolderNameFormat}
        setAdminedTournaments={setAdminedTournaments}
        showErrorDialog={showErrorDialog}
      />
    </>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Hello />} />
      </Routes>
    </Router>
  );
}
