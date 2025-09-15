import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import {
  createRef,
  RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  AppBar,
  Avatar,
  Backdrop,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputBase,
  InputLabel,
  ListItem,
  MenuItem,
  Paper,
  Select,
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
  Eject,
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
  ContextPlayers,
  ContextScore,
  ContextSlot,
  CopyHostFormat,
  CopyHostOrClient,
  CopySettings,
  EnforcerSetting,
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
  Stream,
  Tournament,
} from '../common/types';
import { DraggableChip, DroppableChip } from './DragAndDrop';
import ReplayList, { SkewReplay } from './ReplayList';
import CopyControls from './CopyControls';
import SetControls from './SetControls';
import ErrorDialog from './ErrorDialog';
import Settings from './Settings';
import ManualReport from './ManualReport';
import {
  characterColorIndexLength,
  characterNames,
  frameMsDivisor,
  stageNames,
} from '../common/constants';
import ManualBar from './ManualBar';
import GuidedDialog from './GuidedDialog';
import StartggTournamentForm from './StartggTournamentForm';
import ChallongeTournamentForm from './ChallongeTournamentForm';
import ResetSet from './ResetSet';
import AssignStream from './AssignStream';
import getCharacterIcon from './getCharacterIcon';
import RightColumn from './RightColumn';
import { WindowEvent } from './setWindowEventListener';
import SlpDownloadModal, { SlpDownloadStatus } from './SlpDownloadModal';

const ENFORCER_VERSION = '1.4.4';

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
  scroll-padding-top: 64px;
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
      id: 0,
      displayName: '',
      prefix: '',
      pronouns: '',
    },
  ],
  entrant1Score: null,
  entrant2Id: 0,
  entrant2Participants: [
    {
      id: 0,
      displayName: '',
      prefix: '',
      pronouns: '',
    },
  ],
  entrant2Score: null,
  gameScores: [],
  stream: null,
  station: null,
  ordinal: null,
  wasReported: false,
  updatedAtMs: 0,
  completedAtMs: 0,
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
    const firstMs = replays[i].startAt.getTime();
    const secondMs = replays[i + 1].startAt.getTime();
    if (secondMs - firstMs > 3600000) {
      return true;
    }
  }
  return false;
}

function Hello() {
  const [slpDownloadStatus, setSlpDownloadStatus] = useState<SlpDownloadStatus>(
    { status: 'idle' },
  );

  useEffect(() => {
    const handler = (_event: any, status: SlpDownloadStatus) => {
      setSlpDownloadStatus(status);
    };
    window.electron?.onSlpDownloadStatus?.(handler);
  }, []);

  const [errors, setErrors] = useState<string[]>([]);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const showErrorDialog = (messages: string[]) => {
    setErrors(messages);
    setErrorDialogOpen(true);
  };

  // settings
  const [mode, setMode] = useState<Mode>(Mode.STARTGG);
  const [enforcerSetting, setEnforcerSetting] = useState(EnforcerSetting.NONE);
  const [vlerkMode, setVlerkMode] = useState(false);
  const [vlerkModeExternalId, setVlerkModeExternalId] = useState(-1);
  const [vlerkModeColorIndex, setVlerkModeColorIndex] = useState(-1);
  const [vlerkModeFilterLastIndex, setVlerkModeFilterLastIndex] = useState(0);
  const [vlerkModeFilterNotFound, setVlerkModeFilterNotFound] = useState(false);
  const [guidedMode, setGuidedMode] = useState(false);
  const [fileNameFormat, setFileNameFormat] = useState('');
  const [folderNameFormat, setFolderNameFormat] = useState('');
  const [smuggleCostumeIndex, setSmuggleCostumeIndex] = useState(false);
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
  const [isUsb, setIsUsb] = useState(false);
  const [copyDir, setCopyDir] = useState('');
  const [host, setHost] = useState<CopyHostOrClient>({
    name: '',
    address: '',
  });
  const [hostFormat, setHostFormat] = useState<CopyHostFormat>({
    fileNameFormat: '',
    folderNameFormat: '',
  });
  const [useLAN, setUseLAN] = useState(false);
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
      const useLANPromise = window.electron.getUseLAN();
      const enforcerSettingPromise = window.electron.getEnforcerSetting();
      const vlerkModePromise = window.electron.getVlerkMode();
      const guidedModePromise = window.electron.getGuidedMode();
      const fileNameFormatPromise = window.electron.getFileNameFormat();
      const folderNameFormatPromise = window.electron.getFolderNameFormat();
      const smuggleCostumeIndexPromise =
        window.electron.getSmuggleCostumeIndex();
      const copySettingsPromise = window.electron.getCopySettings();
      const reportSettingsPromise = window.electron.getReportSettings();

      // initial state
      const replaysDirPromise = window.electron.getReplaysDir();
      const copyDirPromise = window.electron.getCopyDir();
      const hostPromise = window.electron.getCopyHost();
      const hostFormatPromise = window.electron.getCopyHostFormat();
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
      setUseLAN(await useLANPromise);
      setEnforcerSetting(await enforcerSettingPromise);
      setFileNameFormat(await fileNameFormatPromise);
      setFolderNameFormat(await folderNameFormatPromise);
      setVlerkMode(await vlerkModePromise);
      setGuidedMode(await guidedModePromise);
      setSmuggleCostumeIndex(await smuggleCostumeIndexPromise);
      setCopySettings(await copySettingsPromise);
      setReportSettings(await reportSettingsPromise);

      // initial state
      const replaysDir = await replaysDirPromise;
      setDir(replaysDir);
      setDirInit(replaysDir.length > 0);
      setCopyDir(await copyDirPromise);
      setHost(await hostPromise);
      setHostFormat(await hostFormatPromise);
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
    };
    inner();
  }, []);

  useEffect(() => {
    window.electron.onCopyHost(async (event, newHost) => {
      if (!newHost.address) {
        const fileNameFormatPromise = window.electron.getFileNameFormat();
        const folderNameFormatPromise = window.electron.getFolderNameFormat();
        const copySettingsPromise = window.electron.getCopySettings();
        const enforcerSettingPromise = window.electron.getEnforcerSetting();
        const smuggleCostumeIndexPromise =
          window.electron.getSmuggleCostumeIndex();
        setFileNameFormat(await fileNameFormatPromise);
        setFolderNameFormat(await folderNameFormatPromise);
        setCopySettings(await copySettingsPromise);
        setEnforcerSetting(await enforcerSettingPromise);
        setSmuggleCostumeIndex(await smuggleCostumeIndexPromise);
        setHostFormat({ fileNameFormat: '', folderNameFormat: '' });
      }
      setHost(newHost);
    });
    window.electron.onCopyHostFormat((event, newHostFormat) => {
      if (newHostFormat.fileNameFormat) {
        setFileNameFormat(newHostFormat.fileNameFormat);
      }
      if (newHostFormat.folderNameFormat) {
        setFolderNameFormat(newHostFormat.folderNameFormat);
      }
      if (newHostFormat.copySettings !== undefined) {
        setCopySettings({ ...newHostFormat.copySettings, output: Output.ZIP });
      }
      if (newHostFormat.enforcerSetting !== undefined) {
        setEnforcerSetting(newHostFormat.enforcerSetting);
      }
      if (newHostFormat.smuggleCostumeIndex !== undefined) {
        setSmuggleCostumeIndex(newHostFormat.smuggleCostumeIndex);
      }
      setHostFormat(newHostFormat);
    });
  }, []);

  const [batchActives, setBatchActives] = useState<
    [
      { active: boolean; teamI: number },
      { active: boolean; teamI: number },
      { active: boolean; teamI: number },
      { active: boolean; teamI: number },
    ]
  >([
    { active: false, teamI: -1 },
    { active: false, teamI: -1 },
    { active: false, teamI: -1 },
    { active: false, teamI: -1 },
  ]);
  const numBatchActive = batchActives.filter(
    (batchActive) => batchActive.active,
  ).length;
  const [overrides, setOverrides] = useState<
    [PlayerOverrides, PlayerOverrides, PlayerOverrides, PlayerOverrides]
  >([
    {
      displayName: '',
      entrantId: 0,
      participantId: 0,
      prefix: '',
      pronouns: '',
    },
    {
      displayName: '',
      entrantId: 0,
      participantId: 0,
      prefix: '',
      pronouns: '',
    },
    {
      displayName: '',
      entrantId: 0,
      participantId: 0,
      prefix: '',
      pronouns: '',
    },
    {
      displayName: '',
      entrantId: 0,
      participantId: 0,
      prefix: '',
      pronouns: '',
    },
  ]);
  const resetOverrides = () => {
    setOverrides([
      {
        displayName: '',
        entrantId: 0,
        participantId: 0,
        prefix: '',
        pronouns: '',
      },
      {
        displayName: '',
        entrantId: 0,
        participantId: 0,
        prefix: '',
        pronouns: '',
      },
      {
        displayName: '',
        entrantId: 0,
        participantId: 0,
        prefix: '',
        pronouns: '',
      },
      {
        displayName: '',
        entrantId: 0,
        participantId: 0,
        prefix: '',
        pronouns: '',
      },
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
  const [replayRefs, setReplayRefs] = useState<RefObject<HTMLDivElement>[]>([]);
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
    const isPlayerArr: [boolean, boolean, boolean, boolean] =
      newReplays.length > 0
        ? newReplays
            .map(
              (replay) =>
                replay.players.map(
                  (player) =>
                    player.playerType === 0 || player.playerType === 1,
                ) as [boolean, boolean, boolean, boolean],
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
    return isPlayerArr.map((isPlayer, i) => ({
      active: teamsConsistent && isPlayer,
      teamI: teamsConsistent ? Array.from(teamIndiciesArr[i].keys())[0] : -1,
    })) as [
      { active: boolean; teamI: number },
      { active: boolean; teamI: number },
      { active: boolean; teamI: number },
      { active: boolean; teamI: number },
    ];
  };
  const [replayLoadCount, setReplayLoadCount] = useState(0);
  const copyControlsRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (copyControlsRef.current) {
      copyControlsRef.current.scrollIntoView(false);
    }
  }, [replayLoadCount]);
  const [skewDetected, setSkewDetected] = useState(false);
  const [skewDialogOpen, setSkewDialogOpen] = useState(false);
  const [wasDeleted, setWasDeleted] = useState(false);
  const chooseDir = async () => {
    setGettingReplays(true);
    const newDir = await window.electron.chooseReplaysDir();
    if (newDir && newDir !== dir) {
      const {
        replays: newReplays,
        invalidReplays: newInvalidReplays,
        replayLoadCount: newReplayLoadCount,
      } = await window.electron.getReplaysInDir();
      applyAllReplaysSelected(newReplays, allReplaysSelected);
      setBatchActives(
        getNewBatchActives(newReplays.filter((replay) => replay.selected)),
      );
      setDir(newDir);
      setIsUsb(false);
      setDirExists(true);
      setDirInit(false);
      resetOverrides();
      const skew = hasTimeSkew(newReplays);
      setSkewDetected(skew);
      if (skew && !vlerkMode) {
        setSkewDialogOpen(true);
      }
      setReplays(newReplays);
      setReplayLoadCount(newReplayLoadCount);
      setInvalidReplays(newInvalidReplays);
      if (newInvalidReplays.length > 0) {
        showErrorDialog(
          newInvalidReplays.map(
            (invalidReplay) =>
              `${invalidReplay.fileName}: ${invalidReplay.invalidReason}`,
          ),
        );
      }
      setReplayRefs(vlerkMode ? newReplays.map(() => createRef()) : []);
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
        setReplayLoadCount(res.replayLoadCount);
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
      if (skew && !vlerkMode) {
        setSkewDialogOpen(true);
      }
      setReplays(newReplays);
      setInvalidReplays(newInvalidReplays);
      if (newInvalidReplays.length > 0) {
        showErrorDialog(
          newInvalidReplays.map(
            (invalidReplay) =>
              `${invalidReplay.fileName}: ${invalidReplay.invalidReason}`,
          ),
        );
      }
      setReplayRefs(vlerkMode ? newReplays.map(() => createRef()) : []);
      setGettingReplays(false);
    },
    [allReplaysSelected, guideActive, mode, vlerkMode],
  );

  const wouldDeleteCopyDir =
    dir.length > 0 && copyDir.length > 0 && dir === copyDir;
  const [ejecting, setEjecting] = useState(false);
  const [ejected, setEjected] = useState(false);
  const deleteDir = async () => {
    if (!dir || wouldDeleteCopyDir) {
      return;
    }

    setDirDeleting(true);
    setEjecting(true);
    try {
      setEjected(await window.electron.deleteReplaysDir());
      setWasDeleted(true);
      await refreshReplays();
    } finally {
      setDirDeleting(false);
      setEjecting(false);
    }
  };
  const deleteSelected = async () => {
    if (!dir || wouldDeleteCopyDir) {
      return;
    }

    setDirDeleting(true);
    try {
      await window.electron.deleteSelectedReplays(
        selectedReplays.map((selectedReplay) => selectedReplay.filePath),
      );
      await refreshReplays();
    } finally {
      setDirDeleting(false);
    }
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

    const newOverrides = Array.from(overrides) as [
      PlayerOverrides,
      PlayerOverrides,
      PlayerOverrides,
      PlayerOverrides,
    ];
    for (let i = 0; i < 4; i += 1) {
      if (batchActives[i].active && !newBatchActives[i].active) {
        newOverrides[i] = {
          displayName: '',
          entrantId: 0,
          participantId: 0,
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
          participantId: 0,
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
    window.electron.onUsb((e, newDir, newIsUsb) => {
      setDir(newDir);
      setIsUsb(newIsUsb);
      setWasDeleted(false);
      refreshReplays(true);
      setEjected(false);
    });
  }, [refreshReplays]);

  const availablePlayers: PlayerOverrides[] = [];
  selectedSet.entrant1Participants.forEach((participant) => {
    availablePlayers.push({
      displayName: participant.displayName,
      entrantId: selectedSet.entrant1Id,
      participantId: participant.id,
      prefix: participant.prefix,
      pronouns: participant.pronouns,
    });
  });
  selectedSet.entrant2Participants.forEach((participant) => {
    availablePlayers.push({
      displayName: participant.displayName,
      entrantId: selectedSet.entrant1Id,
      participantId: participant.id,
      prefix: participant.prefix,
      pronouns: participant.pronouns,
    });
  });

  const [slugDialogOpen, setSlugDialogOpen] = useState(false);
  const [gettingTournament, setGettingTournament] = useState(false);

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

  const findOtherPlayer = (
    entrantId: number,
    participantId: number,
  ): PlayerOverrides => {
    const isEntrant1 = entrantId === selectedSet.entrant1Id;
    const isTeams = selectedSet.entrant1Participants.length > 1;
    if (isEntrant1 && isTeams) {
      const participantToCheck = selectedSet.entrant1Participants.find(
        (participant) => participant.id !== participantId,
      );
      if (participantToCheck) {
        return {
          displayName: participantToCheck.displayName,
          entrantId: selectedSet.entrant1Id,
          participantId: participantToCheck.id,
          prefix: participantToCheck.prefix,
          pronouns: participantToCheck.pronouns,
        };
      }
    } else if (!isEntrant1 && isTeams) {
      const participantToCheck = selectedSet.entrant2Participants.find(
        (participant) => participant.id !== participantId,
      );
      if (participantToCheck) {
        return {
          displayName: participantToCheck.displayName,
          entrantId: selectedSet.entrant2Id,
          participantId: participantToCheck.id,
          prefix: participantToCheck.prefix,
          pronouns: participantToCheck.pronouns,
        };
      }
    } else if (isEntrant1 && !isTeams) {
      return {
        displayName: selectedSet.entrant2Participants[0].displayName,
        entrantId: selectedSet.entrant2Id,
        participantId: selectedSet.entrant2Participants[0].id,
        prefix: selectedSet.entrant2Participants[0].prefix,
        pronouns: selectedSet.entrant2Participants[0].pronouns,
      };
    } else if (!isEntrant1 && !isTeams) {
      return {
        displayName: selectedSet.entrant1Participants[0].displayName,
        entrantId: selectedSet.entrant1Id,
        participantId: selectedSet.entrant1Participants[0].id,
        prefix: selectedSet.entrant1Participants[0].prefix,
        pronouns: selectedSet.entrant1Participants[0].pronouns,
      };
    }
    return {
      displayName: '',
      entrantId: 0,
      participantId: 0,
      prefix: '',
      pronouns: '',
    };
  };

  // for click-assigning set participants
  const [selectedChipData, setSelectedChipData] = useState<PlayerOverrides>({
    displayName: '',
    entrantId: 0,
    participantId: 0,
    prefix: '',
    pronouns: '',
  });
  const resetSelectedChipData = () => {
    setSelectedChipData({
      displayName: '',
      entrantId: 0,
      participantId: 0,
      prefix: '',
      pronouns: '',
    });
  };

  // batch chips
  const onClickOrDrop = (
    displayName: string,
    entrantId: number,
    participantId: number,
    prefix: string,
    pronouns: string,
    index: number,
  ) => {
    const newOverrides = Array.from(overrides) as [
      PlayerOverrides,
      PlayerOverrides,
      PlayerOverrides,
      PlayerOverrides,
    ];
    newOverrides[index] = {
      displayName,
      entrantId,
      participantId,
      prefix,
      pronouns,
    };
    newOverrides.forEach((override, i) => {
      if (
        i !== index &&
        override.entrantId === entrantId &&
        override.participantId === participantId
      ) {
        override.displayName = '';
        override.entrantId = 0;
        override.participantId = 0;
        override.prefix = '';
        override.pronouns = '';
      }
    });

    // pigeonhole remaining player if possible
    if (numBatchActive === availablePlayers.length) {
      const { teamI } = batchActives[index];
      const isTeams = availablePlayers.length === 4 && teamI !== -1;

      // find if there's exactly one hole to pigeon
      const elligibleIndicies: number[] = [];
      for (let i = 0; i < 4; i += 1) {
        if (
          batchActives[i].active &&
          (!isTeams || batchActives[i].teamI === teamI) &&
          newOverrides[i].participantId !== participantId
        ) {
          elligibleIndicies.push(i);
        }
      }
      if (elligibleIndicies.length === 1) {
        const otherPlayer = findOtherPlayer(entrantId, participantId);
        if (otherPlayer.entrantId && otherPlayer.participantId) {
          newOverrides[elligibleIndicies[0]] = otherPlayer;
          newOverrides.forEach((override, i) => {
            if (
              i !== elligibleIndicies[0] &&
              override.entrantId === otherPlayer.entrantId &&
              override.participantId === otherPlayer.participantId
            ) {
              override.displayName = '';
              override.entrantId = 0;
              override.participantId = 0;
              override.prefix = '';
              override.pronouns = '';
            }
          });
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
          otherPlayer.playerOverrides.participantId = 0;
          otherPlayer.playerOverrides.prefix = '';
          otherPlayer.playerOverrides.pronouns = '';
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
          participantId: number,
          prefix: string,
          pronouns: string,
        ) =>
          onClickOrDrop(
            displayName,
            entrantId,
            participantId,
            prefix,
            pronouns,
            index,
          )
        }
      />
    );
  };

  const getTournament = async (maybeSlug: string, initial: boolean = false) => {
    if (!maybeSlug) {
      return '';
    }

    setGettingTournament(true);
    try {
      const actualSlug = await window.electron.getTournament(
        maybeSlug,
        initial && vlerkMode,
      );
      if (slug !== maybeSlug) {
        setSelectedSet(EMPTY_SET);
        setSelectedSetChain(EMPTY_SELECTED_SET_CHAIN);
        await window.electron.setSelectedSetChain(0, 0, 0);
      }
      return actualSlug;
    } catch (e: any) {
      showErrorDialog([e.toString()]);
      return '';
    } finally {
      setGettingTournament(false);
    }
  };

  // set controls
  const selectSet = (set: Set) => {
    const newOverrides: [
      PlayerOverrides,
      PlayerOverrides,
      PlayerOverrides,
      PlayerOverrides,
    ] = [
      {
        displayName: '',
        entrantId: 0,
        participantId: 0,
        prefix: '',
        pronouns: '',
      },
      {
        displayName: '',
        entrantId: 0,
        participantId: 0,
        prefix: '',
        pronouns: '',
      },
      {
        displayName: '',
        entrantId: 0,
        participantId: 0,
        prefix: '',
        pronouns: '',
      },
      {
        displayName: '',
        entrantId: 0,
        participantId: 0,
        prefix: '',
        pronouns: '',
      },
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

  const [startingSet, setStartingSet] = useState(false);
  const startSet = async (originalSet: Set) => {
    setStartingSet(true);
    try {
      if (mode === Mode.STARTGG) {
        await window.electron.startSet(originalSet);
      } else if (mode === Mode.CHALLONGE) {
        await window.electron.startChallongeSet(
          selectedChallongeTournament.slug,
          originalSet.id as number,
        );
      }
    } catch (e: any) {
      showErrorDialog([e.toString()]);
    } finally {
      setStartingSet(false);
    }
  };

  const reportStartggSet = async (set: StartggSet, originalSet: Set) => {
    const updatedSet =
      originalSet.state === State.COMPLETED
        ? await window.electron.updateSet(set)
        : await window.electron.reportSet(set, originalSet);
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
    entrantId: number;
    participantId: number;
    nametag: string;
  };
  type NamesObj = {
    characterNames: Map<string, number>;
    displayName: string;
    entrantId: number;
    participantId: number;
    nametags: Map<string, number>;
  };
  type CombinedNameObj = {
    characterNames: string[];
    displayName: string;
    entrantId: number;
    participantId: number;
    nametags: string[];
  };

  const [isCopying, setIsCopying] = useState(false);
  const [copyError, setCopyError] = useState('');
  const [copyErrorDialogOpen, setCopyErrorDialogOpen] = useState(false);
  const [copySuccess, setCopySuccess] = useState('');

  const onCopy = async (
    updatedSetFields?: {
      id: number | string;
      completedAtMs: number;
      stream: Stream | null;
    },
    violators?: {
      checkNames: Map<string, boolean>;
      displayName: string;
      entrantId: number;
    }[],
  ) => {
    setIsCopying(true);

    let offsetMs = 0;
    let startDate = selectedReplays[0].startAt;
    if (copySettings.writeStartTimes) {
      const lastReplay = selectedReplays[selectedReplays.length - 1];
      const lastStartMs = lastReplay.startAt.getTime();
      const completedMs =
        (updatedSetFields
          ? updatedSetFields.completedAtMs
          : selectedSet.completedAtMs) || Date.now();
      offsetMs =
        completedMs -
        lastStartMs -
        Math.round((lastReplay.lastFrame + 124) / frameMsDivisor);
      startDate = new Date(selectedReplays[0].startAt.getTime() + offsetMs);
    }

    let fileNames = selectedReplays.map((replay) => replay.fileName);
    let subdir = '';
    let context: Context | undefined;
    if (
      copySettings.writeFileNames ||
      copySettings.output === Output.FOLDER ||
      copySettings.output === Output.ZIP
    ) {
      let allEntrantIdsSet = true;
      const nameObjs = selectedReplays.map((replay) =>
        replay.players.map((player): NameObj => {
          if (player.playerType === 0 || player.playerType === 1) {
            if (!player.playerOverrides.entrantId) {
              allEntrantIdsSet = false;
            }
            return {
              characterName: characterNames.get(player.externalCharacterId)!,
              displayName:
                player.playerOverrides.displayName || player.displayName,
              entrantId: player.playerOverrides.entrantId,
              participantId: player.playerOverrides.participantId,
              nametag: player.nametag,
            };
          }
          return {
            characterName: '',
            displayName: '',
            entrantId: 0,
            participantId: 0,
            nametag: '',
          };
        }),
      );

      const nameObjToPlayerOnly = (nameObj: NameObj) => {
        if (nameObj.displayName) {
          return nameObj.displayName;
        }
        if (nameObj.nametag) {
          return nameObj.nametag;
        }
        return nameObj.characterName;
      };
      const combinedNameObjToPlayerOnly = (
        combinedNameObj: CombinedNameObj,
      ) => {
        if (combinedNameObj.displayName) {
          return combinedNameObj.displayName;
        }
        if (combinedNameObj.nametags.length > 0) {
          return combinedNameObj.nametags.join(', ');
        }
        return combinedNameObj.characterNames.join(', ');
      };
      const nameObjToPlayerChar = (nameObj: NameObj) => {
        if (nameObj.displayName) {
          return `${nameObj.displayName} (${nameObj.characterName})`;
        }
        if (nameObj.nametag) {
          return `${nameObj.characterName} (${nameObj.nametag})`;
        }
        return nameObj.characterName;
      };
      const combinedNameObjToPlayerChar = (
        combinedNameObj: CombinedNameObj,
      ) => {
        if (combinedNameObj.displayName) {
          return `${
            combinedNameObj.displayName
          } (${combinedNameObj.characterNames.join(', ')})`;
        }
        if (combinedNameObj.nametags.length > 0) {
          return `${combinedNameObj.characterNames.join(
            ', ',
          )} (${combinedNameObj.nametags.join(', ')})`;
        }
        return combinedNameObj.characterNames.join(', ');
      };
      const entrant1CombinedNameObjs: CombinedNameObj[] = [];
      const entrant2CombinedNameObjs: CombinedNameObj[] = [];

      let roundShort = '';
      const regex = /([A-Z]|[0-9])/g;
      let regexRes = regex.exec(selectedSet.fullRoundText);
      while (regexRes) {
        roundShort += regexRes[0];
        regexRes = regex.exec(selectedSet.fullRoundText);
      }
      const roundLong = String(selectedSet.fullRoundText);
      if (
        copySettings.output === Output.FOLDER ||
        copySettings.output === Output.ZIP
      ) {
        const namesObjs: NamesObj[] = nameObjs[0].map((nameObj) => ({
          characterNames: new Map([[nameObj.characterName, 0]]),
          displayName: nameObj.displayName,
          entrantId: nameObj.entrantId,
          participantId: nameObj.participantId,
          nametags: new Map([[nameObj.nametag, 0]]),
        }));
        if (allEntrantIdsSet) {
          for (let i = 1; i < nameObjs.length; i += 1) {
            for (let j = 0; j < nameObjs[i].length; j += 1) {
              const nameObj = nameObjs[i][j];
              const existingNamesObj = namesObjs.find(
                (namesObj) =>
                  namesObj.entrantId === nameObj.entrantId &&
                  namesObj.participantId === nameObj.participantId,
              )!;
              if (
                nameObj.characterName &&
                !existingNamesObj.characterNames.has(nameObj.characterName)
              ) {
                existingNamesObj.characterNames.set(nameObj.characterName, i);
              }
              if (
                nameObj.nametag &&
                !existingNamesObj.nametags.has(nameObj.nametag)
              ) {
                existingNamesObj.nametags.set(nameObj.nametag, i);
              }
            }
          }
        } else {
          for (let i = 1; i < nameObjs.length; i += 1) {
            for (let j = 0; j < nameObjs[i].length; j += 1) {
              const nameObj = nameObjs[i][j];
              if (nameObj.characterName) {
                namesObjs[j].displayName = nameObj.displayName;
                namesObjs[j].entrantId = nameObj.entrantId;
                if (!namesObjs[j].characterNames.has(nameObj.characterName)) {
                  namesObjs[j].characterNames.set(nameObj.characterName, i);
                }
              }
              if (
                nameObj.nametag &&
                !namesObjs[i].nametags.has(nameObj.nametag)
              ) {
                namesObjs[i].nametags.set(nameObj.nametag, j);
              }
            }
          }
        }
        const combinedNameObjs: CombinedNameObj[] = namesObjs
          .map((namesObj) => ({
            displayName: namesObj.displayName,
            entrantId: namesObj.entrantId,
            participantId: namesObj.participantId,
            characterNames: [...namesObj.characterNames.entries()]
              .sort(([, a], [, b]) => a - b)
              .map((entry) => entry[0]),
            nametags: [...namesObj.nametags.entries()]
              .sort(([, a], [, b]) => a - b)
              .map((entry) => entry[0]),
          }))
          .filter((nameObj) =>
            nameObj.characterNames.some((characterName) => characterName),
          );

        selectedSet.entrant1Participants.forEach((participant) => {
          const combinedNameObj = combinedNameObjs.find(
            (cbn) => cbn.participantId === participant.id,
          );
          if (combinedNameObj) {
            entrant1CombinedNameObjs.push(combinedNameObj);
          }
        });
        selectedSet.entrant2Participants.forEach((participant) => {
          const combinedNameObj = combinedNameObjs.find(
            (cbn) => cbn.participantId === participant.id,
          );
          if (combinedNameObj) {
            entrant2CombinedNameObjs.push(combinedNameObj);
          }
        });

        const playersOnly = `${entrant1CombinedNameObjs
          .map(combinedNameObjToPlayerOnly)
          .join(' + ')} vs ${entrant2CombinedNameObjs
          .map(combinedNameObjToPlayerOnly)
          .join(' + ')}`;
        const playersChars = `${entrant1CombinedNameObjs
          .map(combinedNameObjToPlayerChar)
          .join(' + ')} vs ${entrant2CombinedNameObjs
          .map(combinedNameObjToPlayerChar)
          .join(' + ')}`;
        const singlesChars =
          combinedNameObjs.length === 4 ? playersOnly : playersChars;
        subdir = String(folderNameFormat);
        subdir = subdir.replace('{date}', format(startDate, 'yyyyMMdd'));
        subdir = subdir.replace('{time}', format(startDate, 'HHmm'));
        subdir = subdir.replace('{roundShort}', roundShort);
        subdir = subdir.replace('{roundLong}', roundLong);
        subdir = subdir.replace('{games}', selectedReplays.length.toString(10));
        // do last in case tournament/event/phase/phase group names contain template strings LOL
        subdir = subdir.replace('{tournamentName}', tournament.name);
        subdir = subdir.replace('{tournamentSlug}', tournament.slug);
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
          let phaseOrEvent = '';
          if (selectedSetChain.phase?.hasSiblings) {
            phaseOrEvent = selectedSetChain.phase.name;
          } else if (selectedSetChain.event) {
            phaseOrEvent = selectedSetChain.event.name;
          }
          subdir = subdir.replace('{phaseOrEvent}', phaseOrEvent);
        }
        // do last in case player names contain template strings LOL
        subdir = subdir.replace('{playersOnly}', playersOnly);
        subdir = subdir.replace('{playersChars}', playersChars);
        subdir = subdir.replace('{singlesChars}', singlesChars);
      }

      if (copySettings.writeFileNames) {
        fileNames = nameObjs.map((game, i) => {
          const { stageId, startAt } = selectedReplays[i];
          const writeStartDate = copySettings.writeStartTimes
            ? new Date(startAt.getTime() + offsetMs)
            : startAt;
          const time = format(writeStartDate, 'HHmmss');
          const names = game.filter((nameObj) => nameObj.characterName);
          const playersOnly = names.map(nameObjToPlayerOnly).join(', ');
          const playersChars = names.map(nameObjToPlayerChar).join(', ');
          const singlesChars =
            nameObjs.length === 4 ? playersOnly : playersChars;

          let fileName = `{ordinal}${fileNameFormat}`;
          fileName = fileName.replace(
            '{date}',
            format(writeStartDate, 'yyyyMMdd'),
          );
          fileName = fileName.replace('{time}', time);
          fileName = fileName.replace('{roundShort}', roundShort);
          fileName = fileName.replace('{roundLong}', roundLong);
          fileName = fileName.replace('{stage}', stageNames.get(stageId) || '');
          fileName = fileName.replace(
            '{ordinal}',
            copySettings.output === Output.FILES ? time : (i + 1).toString(10),
          );
          // do last in case player names contain template strings LOL
          fileName = fileName.replace('{playersOnly}', playersOnly);
          fileName = fileName.replace('{playersChars}', playersChars);
          fileName = fileName.replace('{singlesChars}', singlesChars);
          return `${fileName}.slp`;
        });
      }

      if (
        copySettings.writeContext &&
        (copySettings.output === Output.FOLDER ||
          copySettings.output === Output.ZIP)
      ) {
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
          const contextPlayers: ContextPlayers = {
            entrant1: entrant1CombinedNameObjs.map((cbn) => ({
              name: cbn.displayName,
              characters: cbn.characterNames,
            })),
            entrant2: entrant2CombinedNameObjs.map((cbn) => ({
              name: cbn.displayName,
              characters: cbn.characterNames,
            })),
          };
          context = {
            bestOf: Math.max(gameScores[0], gameScores[1]) * 2 - 1,
            durationMs: selectedReplays
              .map((replay) =>
                Math.ceil((replay.lastFrame + 124) / frameMsDivisor),
              )
              .reduce((prev, curr) => prev + curr, 0),
            scores,
            finalScore,
            players: contextPlayers,
            startMs: startDate.getTime(),
          };

          const setId = updatedSetFields ? updatedSetFields.id : selectedSet.id;
          if (setId) {
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
                    typeof setId === 'string' ||
                    (Number.isInteger(setId) && setId > 0)
                      ? setId
                      : undefined,
                  fullRoundText: selectedSet.fullRoundText,
                  ordinal: selectedSet.ordinal,
                  round: selectedSet.round,
                  stream: updatedSetFields
                    ? updatedSetFields.stream
                    : selectedSet.stream,
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
                    Number.isInteger(setId) && (setId as number) > 0
                      ? (setId as number)
                      : undefined,
                  fullRoundText: selectedSet.fullRoundText,
                  ordinal: selectedSet.ordinal,
                  round: selectedSet.round,
                  stream: updatedSetFields
                    ? updatedSetFields.stream
                    : selectedSet.stream,
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
        new Date(replay.startAt.getTime() + offsetMs).toISOString(),
      );
    }
    try {
      await window.electron.writeReplays(
        fileNames,
        copySettings.output,
        selectedReplays,
        startTimes,
        subdir,
        copySettings.writeDisplayNames,
        context,
      );
      if (violators && violators.length > 0) {
        const vsStr = `${selectedSet.entrant1Participants
          .map((participant) => participant.displayName)
          .join('/')} vs ${selectedSet.entrant2Participants
          .map((participant) => participant.displayName)
          .join('/')}`;
        let poolName = '';
        if (mode === Mode.STARTGG) {
          poolName = selectedSetChain.phaseGroup?.name ?? '';
        } else if (mode === Mode.CHALLONGE) {
          poolName = selectedChallongeTournament.name;
        }
        await window.electron.appendEnforcerResult(
          violators
            .map(
              ({ checkNames, displayName, entrantId }) =>
                `${entrantId},${displayName},${Array.from(checkNames.keys())
                  .sort()
                  .join('|')},${poolName},${
                  selectedSet.fullRoundText
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

  const superKey = window.electron.isMac ? 'CMD' : 'CTRL';

  return (
    <>
      <SlpDownloadModal
        status={slpDownloadStatus}
        onClose={async () => {
          setSlpDownloadStatus({ status: 'idle' });
        }}
      />
      <AppBar position="fixed" color="inherit">
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
                          participantId: 0,
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
              {ejected && <Typography variant="body2">Ejected!</Typography>}
              {dir && (
                <Tooltip arrow title="Eject (if USB)">
                  <IconButton
                    disabled={ejecting}
                    onClick={async () => {
                      setEjecting(true);
                      try {
                        setEjected(await window.electron.maybeEject());
                      } finally {
                        setEjecting(false);
                      }
                    }}
                  >
                    <Eject />
                  </IconButton>
                </Tooltip>
              )}
              {dir &&
                dirExists &&
                !gettingReplays &&
                (replays.length > 0 || invalidReplays.length > 0) &&
                (isUsb ? (
                  <>
                    <Tooltip
                      arrow
                      title={
                        wouldDeleteCopyDir
                          ? 'Would delete copy folder'
                          : 'Delete replays folder and eject'
                      }
                    >
                      <div>
                        <IconButton
                          disabled={wouldDeleteCopyDir}
                          onClick={() => setDirDeleteDialogOpen(true)}
                        >
                          <DeleteForeverOutlined />
                        </IconButton>
                      </div>
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
                          {replays.length} replays{' '}
                          {invalidReplays.length > 0
                            ? `(and ${invalidReplays.length} invalid replays) `
                            : ''}
                          will be deleted! (And the drive will be ejected if
                          applicable)
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
                            try {
                              await deleteDir();
                              setGuideState(GuideState.NONE);
                            } catch (e: any) {
                              showErrorDialog([
                                e instanceof Error ? e.message : e,
                              ]);
                            } finally {
                              setDirDeleteDialogOpen(false);
                            }
                          }}
                          variant="contained"
                        >
                          Delete
                        </Button>
                      </DialogActions>
                    </Dialog>
                  </>
                ) : (
                  <Tooltip
                    arrow
                    title={
                      wouldDeleteCopyDir
                        ? 'Would delete copy folder'
                        : 'Delete selected replays'
                    }
                  >
                    <div>
                      <IconButton
                        disabled={
                          selectedReplays.length === 0 ||
                          wouldDeleteCopyDir ||
                          dirDeleting
                        }
                        onClick={() => deleteSelected()}
                      >
                        <DeleteForeverOutlined />
                      </IconButton>
                    </div>
                  </Tooltip>
                ))}
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
            !gettingReplays &&
            (dirExists ? (
              <>
                <ReplayList
                  dirInit={dirInit}
                  numAvailablePlayers={availablePlayers.length}
                  replays={replays}
                  replayRefs={replayRefs}
                  selectedChipData={selectedChipData}
                  findOtherPlayer={findOtherPlayer}
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
                            <Tooltip arrow placement="left" title="First">
                              <div style={{ height: '40px', width: '40px' }} />
                            </Tooltip>
                          ) : (
                            <Tooltip arrow placement="left" title="Move up">
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
                            <Tooltip arrow placement="right" title="Last">
                              <div style={{ height: '40px', width: '40px' }} />
                            </Tooltip>
                          ) : (
                            <Tooltip arrow placement="right" title="Move down">
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
                          const firstMs = replays[i - 1].startAt.getTime();
                          const secondMs = replays[i].startAt.getTime();
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
              </>
            ) : (
              <Alert
                severity={wasDeleted ? 'warning' : 'error'}
                sx={{ mb: '8px', mt: '8px', pl: '10px' }}
              >
                {wasDeleted
                  ? 'Replays folder deleted.'
                  : 'Replays folder not found.'}
              </Alert>
            ))}
          {dir && gettingReplays && (
            <CircularProgress
              size="24px"
              style={{
                marginTop: '8px',
                marginBottom: '8px',
                marginLeft: '10px',
              }}
            />
          )}
          <div ref={copyControlsRef} />
          <CopyControls
            dir={copyDir}
            setDir={setCopyDir}
            useLAN={useLAN}
            host={host}
            hostFormat={hostFormat}
            error={copyError}
            setError={setCopyError}
            errorDialogOpen={copyErrorDialogOpen}
            setErrorDialogOpen={setCopyErrorDialogOpen}
            hasSelectedReplays={selectedReplays.length > 0}
            isCopying={isCopying}
            onCopy={onCopy}
            success={copySuccess}
            copySettings={copySettings}
            setCopySettings={setCopySettings}
            elevateSettings={
              guidedMode &&
              guideBackdropOpen &&
              tournamentSet &&
              copyDirSet &&
              !confirmedCopySettings
            }
            vlerkMode={vlerkMode}
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
          <RightColumn
            mode={mode}
            guideState={guideState}
            selectSet={selectSet}
            setGuideState={setGuideState}
            vlerkMode={vlerkMode}
            selectedSetChain={selectedSetChain}
            setSelectedSetChain={setSelectedSetChain}
            startggTournament={tournament}
            challongeTournaments={challongeTournaments}
            getChallongeTournament={getChallongeTournament}
            setSelectedChallongeTournament={setSelectedChallongeTournament}
            manualNames={manualNames}
            selectedChipData={selectedChipData}
            setSelectedChipData={setSelectedChipData}
          />
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
            {guidedMode ? (
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
                {vlerkMode && (
                  <>
                    <Box>
                      <FormControl>
                        <InputLabel id="vlerk-mode-character-select-label">
                          Character
                        </InputLabel>
                        <Select
                          labelId="vlerk-mode-character-select-label"
                          id="vlerk-mode-character-select"
                          value={vlerkModeExternalId}
                          label="Character"
                          onChange={(event) => {
                            if (Number.isInteger(event.target.value)) {
                              setVlerkModeExternalId(
                                event.target.value as number,
                              );
                              setVlerkModeColorIndex(-1);
                            }
                          }}
                        >
                          <MenuItem value={-1}>Any Character</MenuItem>
                          {Array.from(characterNames.entries())
                            .sort((a, b) => a[1].localeCompare(b[1]))
                            .map(([externalId, characterName]) => (
                              <MenuItem key={externalId} value={externalId}>
                                {characterName}
                              </MenuItem>
                            ))}
                        </Select>
                      </FormControl>
                    </Box>
                    <Box>
                      <FormControl>
                        <InputLabel id="vlerk-mode-color-select-label">
                          Color
                        </InputLabel>
                        <Select
                          labelId="vlerk-mode-color-select-label"
                          id="vlerk-mode-color-select"
                          value={vlerkModeColorIndex}
                          label="Color"
                          onChange={(event) => {
                            if (Number.isInteger(event.target.value)) {
                              setVlerkModeColorIndex(
                                event.target.value as number,
                              );
                            }
                          }}
                        >
                          <MenuItem value={-1}>Any Color</MenuItem>
                          {vlerkModeExternalId !== -1 &&
                            Array(
                              characterColorIndexLength.get(
                                vlerkModeExternalId,
                              )!,
                            )
                              .fill(0)
                              .map((_, i) => i)
                              .map((i) => (
                                <MenuItem key={i} value={i}>
                                  <Avatar
                                    src={getCharacterIcon(
                                      vlerkModeExternalId,
                                      i,
                                    )}
                                    style={{ height: '24px', width: '24px' }}
                                    variant="square"
                                  />
                                </MenuItem>
                              ))}
                        </Select>
                      </FormControl>
                    </Box>
                    <Stack alignItems="center">
                      <Button
                        disabled={
                          replays.length === 0 ||
                          (vlerkModeExternalId === -1 &&
                            vlerkModeColorIndex === -1)
                        }
                        onClick={() => {
                          for (
                            let i = vlerkModeFilterLastIndex + 1;
                            i < replays.length;
                            i += 1
                          ) {
                            const replay = replays[i];
                            if (
                              replay.players.some(
                                (player) =>
                                  player.playerType === 0 &&
                                  (vlerkModeExternalId === -1 ||
                                    vlerkModeExternalId ===
                                      player.externalCharacterId) &&
                                  (vlerkModeColorIndex === -1 ||
                                    vlerkModeColorIndex ===
                                      player.costumeIndex),
                              )
                            ) {
                              replayRefs[i].current!.scrollIntoView({
                                behavior: 'smooth',
                              });
                              setVlerkModeFilterLastIndex(i);
                              setVlerkModeFilterNotFound(false);
                              return;
                            }
                          }
                          if (vlerkModeFilterLastIndex === 0) {
                            setVlerkModeFilterNotFound(true);
                            return;
                          }
                          // return to top and continue
                          for (
                            let i = 0;
                            i < vlerkModeFilterLastIndex;
                            i += 1
                          ) {
                            const replay = replays[i];
                            if (
                              replay.players.some(
                                (player) =>
                                  player.playerType === 0 &&
                                  (vlerkModeExternalId === -1 ||
                                    vlerkModeExternalId ===
                                      player.externalCharacterId) &&
                                  (vlerkModeColorIndex === -1 ||
                                    vlerkModeColorIndex ===
                                      player.costumeIndex),
                              )
                            ) {
                              replayRefs[i].current!.scrollIntoView({
                                behavior: 'smooth',
                              });
                              setVlerkModeFilterLastIndex(i);
                              setVlerkModeFilterNotFound(false);
                              return;
                            }
                          }
                          setVlerkModeFilterLastIndex(0);
                          setVlerkModeFilterNotFound(true);
                        }}
                        variant="contained"
                      >
                        Next
                      </Button>
                      {vlerkModeFilterNotFound ? (
                        <Typography lineHeight="20px" variant="caption">
                          Not found
                        </Typography>
                      ) : (
                        <Box height="20px" />
                      )}
                    </Stack>
                  </>
                )}
                <Stack>
                  <Typography
                    variant="caption"
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      window.electron.openEntrantsWindow();
                    }}
                  >
                    {superKey} + E: View Wave/Pool Entrants
                  </Typography>
                  <Typography
                    variant="caption"
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      window.dispatchEvent(new Event(WindowEvent.CTRLF));
                    }}
                  >
                    {superKey} + F: Search players
                  </Typography>
                  {vlerkMode && (
                    <Typography
                      variant="caption"
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        window.dispatchEvent(new Event(WindowEvent.CTRLS));
                      }}
                    >
                      {superKey} + S: Copy replays
                    </Typography>
                  )}
                  <Typography
                    variant="caption"
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      setSkewDialogOpen(true);
                    }}
                  >
                    {superKey} + T: Re-order replays
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
                        <Tooltip arrow placement="top" title="Started">
                          <HourglassTop fontSize="inherit" />
                        </Tooltip>
                      </>
                    )}
                    {selectedSet.state === State.COMPLETED && (
                      <>
                        &nbsp;
                        <Tooltip arrow placement="top" title="Completed">
                          <Backup fontSize="inherit" />
                        </Tooltip>
                      </>
                    )}
                  </Stack>
                  <Tooltip arrow placement="top" title="Click or drag!">
                    <Stack direction="row" gap="8px">
                      <Stack gap="8px" width="50%">
                        <DraggableChip
                          entrantId={selectedSet.entrant1Id}
                          nameWithHighlight={{
                            name: selectedSet.entrant1Participants[0]
                              .displayName,
                          }}
                          participantId={selectedSet.entrant1Participants[0].id}
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
                            participantId={
                              selectedSet.entrant1Participants[1].id
                            }
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
                          participantId={selectedSet.entrant2Participants[0].id}
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
                            participantId={
                              selectedSet.entrant2Participants[1].id
                            }
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
              <AssignStream mode={mode} selectedSet={selectedSet} />
              <ResetSet mode={mode} selectedSet={selectedSet} />
              <Tooltip arrow title="Mark set started">
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
                    onClick={() => startSet(selectedSet)}
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
                deleteReplays={isUsb ? deleteDir : deleteSelected}
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
                isCopying={isCopying}
                copyDisabled={
                  (!copyDir && !host.address) || selectedReplays.length === 0
                }
                isDeleting={dirDeleting}
                dqId={dq.entrantId}
                hasRemainingReplays={hasRemainingReplays}
                reportSettings={reportSettings}
                selectedReplays={selectedReplays}
                set={selectedSet}
                elevate={
                  guideActive &&
                  guideBackdropOpen &&
                  guideState === GuideState.PLAYERS
                }
                enforcerVersion={ENFORCER_VERSION}
                enforcerSetting={enforcerSetting}
                smuggleCostumeIndex={smuggleCostumeIndex}
                wouldDeleteCopyDir={wouldDeleteCopyDir}
                replayLoadCount={replayLoadCount}
              />
            </Stack>
          </Stack>
        </BottomColumns>
      </Bottom>
      <Backdrop
        onClick={resetSelectedChipData}
        open={Boolean(
          selectedChipData.entrantId && selectedChipData.participantId,
        )}
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
        useLAN={useLAN}
        setUseLAN={setUseLAN}
        enforcerSetting={enforcerSetting}
        setEnforcerSetting={setEnforcerSetting}
        vlerkMode={vlerkMode}
        setVlerkMode={setVlerkMode}
        guidedMode={guidedMode}
        setGuidedMode={setGuidedMode}
        smuggleCostumeIndex={smuggleCostumeIndex}
        setSmuggleCostumeIndex={setSmuggleCostumeIndex}
        fileNameFormat={fileNameFormat}
        setFileNameFormat={setFileNameFormat}
        folderNameFormat={folderNameFormat}
        setFolderNameFormat={setFolderNameFormat}
        setAdminedTournaments={setAdminedTournaments}
        showErrorDialog={showErrorDialog}
        enforcerVersion={ENFORCER_VERSION}
        hostFormat={hostFormat}
      />
      <GlobalHotKeys
        keyMap={{
          COPY: window.electron.isMac
            ? ['command+s', 'command+S']
            : ['ctrl+s', 'ctrl+S'],
          ENTRANTS: window.electron.isMac
            ? ['command+e', 'command+E']
            : ['ctrl+e', 'ctrl+E'],
          ESC: 'escape',
          FIND: window.electron.isMac
            ? ['command+f', 'command+F']
            : ['ctrl+f', 'ctrl+F'],
          SKEW: window.electron.isMac
            ? ['command+t', 'command+T']
            : ['ctrl+t', 'ctrl+T'],
        }}
        handlers={{
          COPY: () => {
            window.dispatchEvent(new Event(WindowEvent.CTRLS));
          },
          ENTRANTS: () => {
            window.electron.openEntrantsWindow();
          },
          ESC: () => {
            window.dispatchEvent(new Event(WindowEvent.ESCAPE));
          },
          FIND: () => {
            window.dispatchEvent(new Event(WindowEvent.CTRLF));
          },
          SKEW: () => {
            setSkewDialogOpen(true);
          },
        }}
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
