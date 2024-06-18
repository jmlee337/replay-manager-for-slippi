import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
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
  Paper,
  Stack,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import {
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
import { IpcRendererEvent } from 'electron';
import {
  Context,
  ContextScore,
  ContextSlot,
  CopySettings,
  Event,
  InvalidReplay,
  Mode,
  Output,
  Phase,
  PhaseGroup,
  PlayerOverrides,
  Replay,
  ReportSettings,
  Set,
  StartggSet,
  Tournament,
} from '../common/types';
import { DraggableChip, DroppableChip } from './DragAndDrop';
import ReplayList from './ReplayList';
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

const Form = styled.form`
  align-items: center;
  display: flex;
  margin-top: 8px;
`;

const EMPTY_SET: Set = {
  id: 0,
  state: 0,
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
  twitchStream: null,
};

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
  const [autoDetectUsb, setAutoDetectUsb] = useState(false);
  const [scrollToBottom, setScrollToBottom] = useState(false);
  const [useEnforcer, setUseEnforcer] = useState(false);
  const [fileNameFormat, setFileNameFormat] = useState('');
  const [folderNameFormat, setFolderNameFormat] = useState('');
  const [appVersion, setAppVersion] = useState('');
  const [latestAppVersion, setLatestAppVersion] = useState('');
  // copy settings
  const [copySettings, setCopySettings] = useState<CopySettings>({
    output: Output.FILES,
    writeContext: false,
    writeDisplayNames: false,
    writeFileNames: false,
    writeStartTimes: false,
  });
  // report settings
  const [reportSettings, setReportSettings] = useState<ReportSettings>({
    alsoCopy: false,
    alsoDelete: false,
  });
  useEffect(() => {
    const inner = async () => {
      const appVersionPromise = window.electron.getVersion();
      const latestAppVersionPromise = window.electron.getLatestVersion();
      const modePromise = window.electron.getMode();
      const startggKeyPromise = window.electron.getStartggKey();
      const autoDetectUsbPromise = window.electron.getAutoDetectUsb();
      const scrollToBottomPromise = window.electron.getScrollToBottom();
      const useEnforcerPromise = window.electron.getUseEnforcer();
      const fileNameFormatPromise = window.electron.getFileNameFormat();
      const folderNameFormatPromise = window.electron.getFolderNameFormat();
      const copySettingsPromise = window.electron.getCopySettings();
      const reportSettingsPromise = window.electron.getReportSettings();
      setAppVersion(await appVersionPromise);
      setLatestAppVersion(await latestAppVersionPromise);
      setMode(await modePromise);
      setStartggApiKey(await startggKeyPromise);
      setAutoDetectUsb(await autoDetectUsbPromise);
      setScrollToBottom(await scrollToBottomPromise);
      setUseEnforcer(await useEnforcerPromise);
      setFileNameFormat(await fileNameFormatPromise);
      setFolderNameFormat(await folderNameFormatPromise);
      setCopySettings(await copySettingsPromise);
      setReportSettings(await reportSettingsPromise);
      setGotSettings(true);
    };
    inner();
  }, []);

  const [batchActives, setBatchActives] = useState([
    { active: false, teamId: -1 },
    { active: false, teamId: -1 },
    { active: false, teamId: -1 },
    { active: false, teamId: -1 },
  ]);
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
  const [dir, setDir] = useState('');
  const [dirDeleteDialogOpen, setDirDeleteDialogOpen] = useState(false);
  const [dirDeleting, setDirDeleting] = useState(false);
  const [dirExists, setDirExists] = useState(true);
  const [replays, setReplays] = useState<Replay[]>([]);
  const selectedReplays = replays.filter((replay) => replay.selected);
  const applyAllReplaysSelected = (allReplays: Replay[], selected: boolean) =>
    allReplays
      .filter((replay) => replay.isValid)
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
    const teamIdsArr = [
      new Map<number, boolean>(),
      new Map<number, boolean>(),
      new Map<number, boolean>(),
      new Map<number, boolean>(),
    ];
    newReplays.forEach((replay) => {
      for (let i = 0; i < 4; i += 1) {
        teamIdsArr[i].set(replay.players[i].teamId, true);
      }
    });
    return isPlayerArr.map((isPlayer, i) => {
      const teamIds = teamIdsArr[i];
      const oneTeam = teamIds.size === 1;
      const teamId = oneTeam ? Array.from(teamIds.keys())[0] : -1;
      return { active: isPlayer && oneTeam, teamId };
    });
  };
  const [replayLoadCount, setReplayLoadCount] = useState(0);
  const copyControlsRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (scrollToBottom && copyControlsRef.current) {
      copyControlsRef.current.scrollIntoView();
    }
  }, [replayLoadCount, scrollToBottom]);
  const chooseDir = async () => {
    const newDir = await window.electron.chooseReplaysDir();
    if (newDir) {
      const { replays: newReplays, invalidReplays } =
        await window.electron.getReplaysInDir();
      applyAllReplaysSelected(newReplays, allReplaysSelected);
      setBatchActives(
        getNewBatchActives(newReplays.filter((replay) => replay.selected)),
      );
      setDir(newDir);
      setDirExists(true);
      resetOverrides();
      setReplays(newReplays);
      setReplayLoadCount((r) => r + 1);
      if (invalidReplays.length > 0) {
        showErrorDialog(
          invalidReplays.map(
            (invalidReplay) =>
              `${invalidReplay.fileName}: ${invalidReplay.invalidReason}`,
          ),
        );
      }
    }
  };
  const refreshReplays = useCallback(async () => {
    let newReplays: Replay[] = [];
    let invalidReplays: InvalidReplay[] = [];
    try {
      const res = await window.electron.getReplaysInDir();
      newReplays = res.replays;
      invalidReplays = res.invalidReplays;
      setDirExists(true);
    } catch (e: any) {
      setDirExists(false);
    }
    applyAllReplaysSelected(newReplays, allReplaysSelected);
    setBatchActives(
      getNewBatchActives(newReplays.filter((replay) => replay.selected)),
    );
    resetOverrides();
    setReplays(newReplays);
    setReplayLoadCount((r) => r + 1);
    if (invalidReplays.length > 0) {
      showErrorDialog(
        invalidReplays.map(
          (invalidReplay) =>
            `${invalidReplay.fileName}: ${invalidReplay.invalidReason}`,
        ),
      );
    }
  }, [allReplaysSelected]);
  const deleteDir = async () => {
    if (!dir) {
      return;
    }

    await window.electron.deleteReplaysDir();
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
        player.overrideWin = false;
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
    window.electron.onUsb((event: IpcRendererEvent, newDir: string) => {
      if (newDir) {
        setDir(newDir);
      }
      refreshReplays();
    });
  }, [refreshReplays]);

  const [selectedSet, setSelectedSet] = useState<Set>(EMPTY_SET);
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

  // Tournament view
  const [slug, setSlug] = useState('');
  const [slugDialogOpen, setSlugDialogOpen] = useState(false);
  const [gettingTournament, setGettingTournament] = useState(false);
  const [tournament, setTournament] = useState<Tournament>({
    slug: '',
    name: '',
    events: [],
  });

  const getPhaseGroup = async (
    id: number,
    phaseId: number,
    eventId: number,
    isRoot: boolean,
    updatedSets?: Map<number, Set>,
  ) => {
    const editEvent = tournament.events.find((event) => event.id === eventId);
    if (!editEvent) {
      return;
    }

    let sets;
    try {
      sets = await window.electron.getPhaseGroup(
        id,
        editEvent.isDoubles,
        updatedSets,
      );
    } catch (e: any) {
      showErrorDialog([e.toString()]);
      return;
    }

    const editPhase = editEvent.phases.find((phase) => phase.id === phaseId);
    if (!editPhase) {
      return;
    }

    const editPhaseGroup = editPhase.phaseGroups.find(
      (phaseGroup) => phaseGroup.id === id,
    );
    if (editPhaseGroup) {
      editPhaseGroup.sets = sets;
      if (selectedSet.id) {
        const updatedSelectedSet =
          sets.completedSets.find((set) => set.id === selectedSet.id) ||
          sets.pendingSets.find((set) => set.id === selectedSet.id);
        if (updatedSelectedSet) {
          setSelectedSet(updatedSelectedSet);
        }
      }
      if (isRoot) {
        setTournament({ ...tournament });
      }
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
    if (
      batchActives.filter((batchActive) => batchActive.active).length ===
      availablePlayers.length
    ) {
      const overrideSet = new Map<string, boolean>();
      const remainingIndices: number[] = [];
      const { teamId } = batchActives[index];
      const isTeams = availablePlayers.length === 4 && teamId !== -1;

      // find if there's exactly one hole to pigeon
      const batchActivesWithIndex = batchActives
        .map((batchActive, i) => ({
          active: batchActive.active,
          teamId: batchActive.teamId,
          i,
        }))
        .filter(
          (batchActiveWithIndex) =>
            batchActiveWithIndex.active &&
            (!isTeams || batchActiveWithIndex.teamId === teamId),
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
        label={overrides[index].displayName || `P${index + 1}`}
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

  const getPhase = async (id: number, eventId: number, isRoot: boolean) => {
    let phaseGroups;
    try {
      phaseGroups = await window.electron.getPhase(id);
    } catch (e: any) {
      showErrorDialog([e.toString()]);
      return;
    }

    const editEvent = tournament.events.find((event) => event.id === eventId);
    if (!editEvent) {
      return;
    }

    const editPhase = editEvent.phases.find((phase) => phase.id === id);
    if (editPhase) {
      if (editPhase.phaseGroups.length > 0) {
        const phaseGroupsMap = new Map<number, PhaseGroup>();
        editPhase.phaseGroups.forEach((phaseGroup) => {
          phaseGroupsMap.set(phaseGroup.id, phaseGroup);
        });
        phaseGroups = phaseGroups.map(
          (phaseGroup) => phaseGroupsMap.get(phaseGroup.id) || phaseGroup,
        );
      }
      editPhase.phaseGroups = phaseGroups;
      const phaseGroupsWithChildren = phaseGroups.filter(
        (phaseGroup) =>
          phaseGroup.sets.completedSets.length > 0 ||
          phaseGroup.sets.pendingSets.length > 0,
      );
      if (phaseGroupsWithChildren.length > 0) {
        await Promise.all(
          phaseGroupsWithChildren.map(async (phaseGroup) =>
            getPhaseGroup(phaseGroup.id, id, eventId, false),
          ),
        );
      } else if (phaseGroups.length === 1) {
        await getPhaseGroup(phaseGroups[0].id, id, eventId, false);
      }
      if (isRoot) {
        setTournament({ ...tournament });
      }
    }
  };

  const getEvent = async (id: number, isRoot: boolean) => {
    let phases;
    try {
      phases = await window.electron.getEvent(id);
    } catch (e: any) {
      showErrorDialog([e.toString()]);
      return;
    }

    const editEvent = tournament.events.find((event) => event.id === id);
    if (editEvent) {
      if (editEvent.phases.length > 0) {
        const phasesMap = new Map<number, Phase>();
        editEvent.phases.forEach((phase) => {
          phasesMap.set(phase.id, phase);
        });
        phases = phases.map((phase) => phasesMap.get(phase.id) || phase);
      }
      editEvent.phases = phases;
      const phasesWithChildren = phases.filter(
        (phase) => phase.phaseGroups.length > 0,
      );
      if (phasesWithChildren.length > 0) {
        await Promise.all(
          phasesWithChildren.map(async (phase) =>
            getPhase(phase.id, id, false),
          ),
        );
      } else if (phases.length === 1) {
        await getPhase(phases[0].id, id, false);
      }
      if (isRoot) {
        setTournament({ ...tournament });
      }
    }
  };

  const getTournament = async (getSlug: string) => {
    if (!getSlug) {
      return false;
    }

    let newTournament;
    setGettingTournament(true);
    try {
      newTournament = await window.electron.getTournament(getSlug);
    } catch (e: any) {
      showErrorDialog([e.toString()]);
      setGettingTournament(false);
      return false;
    }

    if (tournament.slug === getSlug && tournament.events.length > 0) {
      const eventsMap = new Map<number, Event>();
      tournament.events.forEach((event) => {
        eventsMap.set(event.id, event);
      });
      newTournament.events = newTournament.events.map(
        (event) => eventsMap.get(event.id) || event,
      );
    }
    tournament.events = newTournament.events;
    tournament.name = newTournament.name;
    tournament.slug = getSlug;
    const eventsWithChildren = newTournament.events.filter(
      (event) => event.phases.length > 0,
    );
    if (eventsWithChildren.length > 0) {
      await Promise.all(
        eventsWithChildren.map(async (event) => getEvent(event.id, false)),
      );
    } else if (newTournament.events.length === 1) {
      await getEvent(newTournament.events[0].id, false);
    }
    setTournament(tournament);
    setGettingTournament(false);
    return true;
  };
  const getTournamentOnSubmit = async (event: FormEvent<HTMLFormElement>) => {
    const target = event.target as typeof event.target & {
      slug: { value: string };
    };
    const newSlug = target.slug.value;
    event.preventDefault();
    event.stopPropagation();
    if (newSlug) {
      setSlugDialogOpen(false);
      if (await getTournament(newSlug)) {
        setSlug(newSlug);
      }
    }
  };

  const [manualNames, setManualNames] = useState<string[]>([]);
  const [manualDialogOpen, setManualDialogOpen] = useState(false);

  // set controls
  const [selectedSetChain, setSelectedSetChain] = useState({
    eventId: 0,
    eventName: '',
    eventSlug: '',
    phaseId: 0,
    phaseName: '',
    phaseGroupId: 0,
    phaseGroupName: '',
  });
  const selectSet = (
    set: Set,
    phaseGroupId: number,
    phaseGroupName: string,
    phaseId: number,
    phaseName: string,
    eventId: number,
    eventName: string,
    eventSlug: string,
  ) => {
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

    setOverrides(newOverrides);
    setReplays(newReplays);
    setSelectedSetChain({
      eventId,
      eventName,
      eventSlug,
      phaseId,
      phaseName,
      phaseGroupId,
      phaseGroupName,
    });
    setSelectedSet(set);
  };

  const [startingSet, setStartingSet] = useState(false);
  const startSet = async (setId: number) => {
    setStartingSet(true);
    try {
      const updatedSet = await window.electron.startSet(setId);
      await getPhaseGroup(
        selectedSetChain.phaseGroupId,
        selectedSetChain.phaseId,
        selectedSetChain.eventId,
        true,
        new Map([[updatedSet.id, updatedSet]]),
      );
    } catch (e: any) {
      showErrorDialog([e.toString()]);
    } finally {
      setStartingSet(false);
    }
  };

  const reportSet = async (set: StartggSet, update: boolean) => {
    const updatedSets = new Map<number, Set>();
    if (update) {
      const updatedSet = await window.electron.updateSet(set);
      updatedSets.set(updatedSet.id, updatedSet);
    } else {
      (await window.electron.reportSet(set)).forEach((updatedSet) => {
        updatedSets.set(updatedSet.id, updatedSet);
      });
    }
    await getPhaseGroup(
      selectedSetChain.phaseGroupId,
      selectedSetChain.phaseId,
      selectedSetChain.eventId,
      true,
      updatedSets,
    );
    resetDq();
    return updatedSets.get(set.setId);
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
  const [copyDir, setCopyDir] = useState('');
  const [copyError, setCopyError] = useState('');
  const [copyErrorDialogOpen, setCopyErrorDialogOpen] = useState(false);
  const [copySuccess, setCopySuccess] = useState('');

  const onCopy = async (set?: Set) => {
    setIsCopying(true);
    const copySet = set ?? selectedSet;

    let offsetMs = 0;
    let startDate = selectedReplays[0].startAt;
    if (copySettings.writeStartTimes) {
      const lastReplay = selectedReplays[selectedReplays.length - 1];
      const lastStartMs = lastReplay.startAt.getTime();
      offsetMs =
        Date.now() -
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
        subdir = subdir.replace('{event}', selectedSetChain.eventName);
        subdir = subdir.replace('{phase}', selectedSetChain.phaseName);
        subdir = subdir.replace(
          '{phaseGroup}',
          selectedSetChain.phaseGroupName,
        );
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
          const names = game.filter((nameObj) => nameObj.characterName);
          const playersOnly = names.map(toPlayerOnly).join(', ');
          const playersChars = names.map(toPlayerChar).join(', ');
          const singlesChars =
            nameObjs.length === 4 ? playersOnly : playersChars;

          let fileName = String(fileNameFormat);
          fileName = fileName.replace(
            '{date}',
            format(writeStartDate, 'yyyyMMdd'),
          );
          fileName = fileName.replace(
            '{time}',
            format(writeStartDate, 'HHmmss'),
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
        const scores: ContextScore[] = [];
        const gameScores = [0, 0];
        selectedReplays.forEach((replay) => {
          const slots: ContextSlot[] = [];
          const usedK = new Map<number, boolean>();
          const hasOverrideWin =
            replay.players.findIndex((player) => player.overrideWin) !== -1;
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
                slots[j].displayNames.push(
                  player.playerOverrides.displayName || player.displayName,
                );
                slots[j].ports.push(player.port);
                slots[j].prefixes.push(player.playerOverrides.prefix);
                slots[j].pronouns.push(player.playerOverrides.pronouns);
                if (
                  player.overrideWin ||
                  (!hasOverrideWin && player.isWinner)
                ) {
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
          scores.push({ slots });
        });
        context = {
          bestOf: Math.max(gameScores[0], gameScores[1]) * 2 - 1,
          durationMs: selectedReplays
            .map((replay) =>
              Math.ceil((replay.lastFrame + 124) / frameMsDivisor),
            )
            .reduce((prev, curr) => prev + curr, 0),
          scores,
          startMs: startDate.getTime(),
        };

        if (copySet.id) {
          context.startgg = {
            tournament: {
              name: tournament.name,
            },
            event: {
              id: selectedSetChain.eventId,
              name: selectedSetChain.eventName,
              slug: selectedSetChain.eventSlug,
            },
            phase: {
              id: selectedSetChain.phaseId,
              name: selectedSetChain.phaseName,
            },
            phaseGroup: {
              id: selectedSetChain.phaseGroupId,
              name: selectedSetChain.phaseGroupName,
            },
            set: {
              id: copySet.id,
              fullRoundText: copySet.fullRoundText,
              round: copySet.round,
              twitchStream: copySet.twitchStream,
            },
          };
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
        copyDir,
        fileNames,
        copySettings.output,
        selectedReplays,
        startTimes,
        subdir,
        copySettings.writeDisplayNames,
        context,
      );
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
                        player.overrideWin = false;
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
              {dir && dirExists && (
                <>
                  <Tooltip arrow title="Delete replays folder">
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
                        {replays.length} replays will be deleted!
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
              {dir && (
                <Tooltip arrow title="Refresh replays">
                  <IconButton onClick={refreshReplays}>
                    <Refresh />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip arrow title="Set replays folder">
                <IconButton onClick={chooseDir}>
                  <FolderOpen />
                </IconButton>
              </Tooltip>
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
                  value={slug || 'Set tournament slug...'}
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
                <Tooltip arrow title="Set tournament slug">
                  <IconButton
                    aria-label="Set tournament slug"
                    onClick={() => setSlugDialogOpen(true)}
                  >
                    <Edit />
                  </IconButton>
                </Tooltip>
                <Dialog
                  open={slugDialogOpen}
                  onClose={() => setSlugDialogOpen(false)}
                >
                  <DialogTitle>Set Tournament Slug</DialogTitle>
                  <DialogContent>
                    <Form onSubmit={getTournamentOnSubmit}>
                      <TextField
                        autoFocus
                        label="Tournament Slug"
                        name="slug"
                        placeholder="super-smash-con-2023"
                        size="small"
                        variant="outlined"
                      />
                      <Button type="submit">Get!</Button>
                    </Form>
                  </DialogContent>
                </Dialog>
              </Stack>
            )}
            {mode === Mode.MANUAL && (
              <ManualBar
                manualDialogOpen={manualDialogOpen}
                setManualDialogOpen={setManualDialogOpen}
                manualNames={manualNames}
                setManualNames={setManualNames}
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
          {dirExists ? (
            <ReplayList
              numAvailablePlayers={availablePlayers.length}
              replays={replays}
              selectedChipData={selectedChipData}
              findUnusedPlayer={findUnusedPlayer}
              onClick={onReplayClick}
              onOverride={onPlayerOverride}
              resetSelectedChipData={resetSelectedChipData}
            />
          ) : (
            <Alert severity="error" sx={{ mb: '8px', pl: '24px' }}>
              Folder not found
            </Alert>
          )}
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
          />
          <div ref={copyControlsRef} />
        </TopColumn>
        <TopColumn width="300px">
          {mode === Mode.STARTGG && (
            <StartggView
              tournament={tournament}
              getEvent={(id: number) => getEvent(id, true)}
              getPhase={(id: number, eventId: number) =>
                getPhase(id, eventId, true)
              }
              getPhaseGroup={(id: number, phaseId: number, eventId: number) =>
                getPhaseGroup(id, phaseId, eventId, true)
              }
              selectSet={selectSet}
            />
          )}
          {mode === Mode.MANUAL && (
            <ManualView
              manualNames={manualNames}
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
          </Stack>
          <Stack justifyContent="space-between" width="300px">
            <Stack>
              {!!selectedSet.id && (
                <>
                  <Stack
                    alignItems="center"
                    justifyContent="center"
                    direction="row"
                  >
                    <Typography lineHeight="20px" variant="caption">
                      {selectedSet.fullRoundText} ({selectedSet.id})
                    </Typography>
                    {selectedSet.state === 2 && (
                      <>
                        &nbsp;
                        <Tooltip title="Started">
                          <HourglassTop fontSize="inherit" />
                        </Tooltip>
                      </>
                    )}
                    {selectedSet.state === 3 && (
                      <>
                        &nbsp;
                        <Tooltip placement="top" title="Finished">
                          <Backup fontSize="inherit" />
                        </Tooltip>
                      </>
                    )}
                  </Stack>
                  <Tooltip arrow title="Drag or select players!">
                    <Stack direction="row" gap="8px">
                      <Stack gap="8px" width="50%">
                        <DraggableChip
                          displayName={
                            selectedSet.entrant1Participants[0].displayName
                          }
                          entrantId={selectedSet.entrant1Id}
                          prefix={selectedSet.entrant1Participants[0].prefix}
                          pronouns={
                            selectedSet.entrant1Participants[0].pronouns
                          }
                          selectedChipData={selectedChipData}
                          setSelectedChipData={setSelectedChipData}
                        />
                        {selectedSet.entrant1Participants.length > 1 && (
                          <DraggableChip
                            displayName={
                              selectedSet.entrant1Participants[1].displayName
                            }
                            entrantId={selectedSet.entrant1Id}
                            prefix={selectedSet.entrant1Participants[1].prefix}
                            pronouns={
                              selectedSet.entrant1Participants[1].pronouns
                            }
                            selectedChipData={selectedChipData}
                            setSelectedChipData={setSelectedChipData}
                          />
                        )}
                      </Stack>
                      <Stack gap="8px" width="50%">
                        <DraggableChip
                          displayName={
                            selectedSet.entrant2Participants[0].displayName
                          }
                          entrantId={selectedSet.entrant2Id}
                          prefix={selectedSet.entrant2Participants[0].prefix}
                          pronouns={
                            selectedSet.entrant2Participants[0].pronouns
                          }
                          selectedChipData={selectedChipData}
                          setSelectedChipData={setSelectedChipData}
                        />
                        {selectedSet.entrant2Participants.length > 1 && (
                          <DraggableChip
                            displayName={
                              selectedSet.entrant2Participants[1].displayName
                            }
                            entrantId={selectedSet.entrant2Id}
                            prefix={selectedSet.entrant2Participants[1].prefix}
                            pronouns={
                              selectedSet.entrant2Participants[1].pronouns
                            }
                            selectedChipData={selectedChipData}
                            setSelectedChipData={setSelectedChipData}
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
                      !(selectedSet.id && selectedSet.state < 2) || startingSet
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
              <ManualReport reportSet={reportSet} selectedSet={selectedSet} />
              <SetControls
                copyReplays={onCopy}
                deleteReplays={deleteDir}
                reportSet={reportSet}
                setReportSettings={async (
                  newReportSettings: ReportSettings,
                ) => {
                  await window.electron.setReportSettings(newReportSettings);
                  setReportSettings(newReportSettings);
                }}
                copyDisabled={
                  isCopying || !copyDir || selectedReplays.length === 0
                }
                dqId={dq.entrantId}
                reportSettings={reportSettings}
                selectedReplays={selectedReplays}
                set={selectedSet}
                useEnforcer={useEnforcer}
              />
            </Stack>
          </Stack>
        </BottomColumns>
      </Bottom>
      <Backdrop
        onClick={resetSelectedChipData}
        open={!!(selectedChipData.displayName && selectedChipData.entrantId)}
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
        setMode={(newMode: Mode) => {
          setMode(newMode);
          setSelectedSet(EMPTY_SET);
        }}
        startggApiKey={startggApiKey}
        setStartggApiKey={setStartggApiKey}
        autoDetectUsb={autoDetectUsb}
        setAutoDetectUsb={setAutoDetectUsb}
        scrollToBottom={scrollToBottom}
        setScrollToBottom={setScrollToBottom}
        useEnforcer={useEnforcer}
        setUseEnforcer={setUseEnforcer}
        fileNameFormat={fileNameFormat}
        setFileNameFormat={setFileNameFormat}
        folderNameFormat={folderNameFormat}
        setFolderNameFormat={setFolderNameFormat}
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
