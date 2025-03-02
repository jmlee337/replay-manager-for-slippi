import {
  Alert,
  Avatar,
  Box,
  Checkbox,
  Chip,
  createTheme,
  IconButton,
  List,
  ListItemButton,
  Stack,
  ThemeProvider,
  Tooltip,
} from '@mui/material';
import {
  EmojiEventsOutlined,
  EmojiEvents,
  HideSource,
} from '@mui/icons-material';
import { memo, useCallback } from 'react';
import styled from '@emotion/styled';
import { format } from 'date-fns';
import { PlayerOverrides, Replay } from '../common/types';
import {
  characterNames,
  frameMsDivisor,
  isValidCharacter,
  shortStageNames,
  stageNames,
} from '../common/constants';
import { DroppableChip } from './DragAndDrop';
import getCharacterIcon from './getCharacterIcon';

const PlayersRow = styled.div`
  display: flex;
`;

const QuarterSegment = styled.div`
  align-items: center;
  box-sizing: border-box;
  display: flex;
  padding-left: 4px;
  min-width: 25%;
`;

const ReplayContent = styled.div`
  display: flex;
  flex-direction: column;
  flex-grow: 1;
`;

const chipStyle = {
  width: '25%',
};

export function SkewReplay({ replay }: { replay: Replay }) {
  const time = format(replay.startAt, 'h:mmaaa');
  const dateShort = format(replay.startAt, 'yyyy MMM dd');
  const duration = format(
    new Date((replay.lastFrame + 124) / frameMsDivisor),
    "m'm'ss's'",
  );
  const shortStageName =
    shortStageNames.get(replay.stageId) || replay.stageId.toString();
  return (
    <Stack width="275px">
      <Stack direction="row">
        <ThemeProvider
          theme={createTheme({
            components: {
              MuiChip: {
                styleOverrides: {
                  label: {
                    alignItems: 'center',
                    display: 'flex',
                    flexGrow: 1,
                  },
                },
              },
            },
          })}
        >
          {replay.players.map((player) =>
            player.playerType === 0 || player.playerType === 1 ? (
              <Chip
                key={player.port}
                icon={
                  isValidCharacter(player.externalCharacterId) ? (
                    <Avatar
                      alt={characterNames.get(player.externalCharacterId)}
                      src={getCharacterIcon(
                        player.externalCharacterId,
                        player.costumeIndex,
                      )}
                      style={{ height: '24px', width: '24px' }}
                      variant="square"
                    />
                  ) : undefined
                }
                style={{ width: '25%' }}
                variant="outlined"
              />
            ) : (
              <Chip
                key={player.port}
                icon={<HideSource />}
                style={{ width: '25%' }}
              />
            ),
          )}
        </ThemeProvider>
      </Stack>
      <Stack direction="row" typography="caption">
        <Box width="50%">
          {dateShort}, {time}
        </Box>
        <Box width="25%">{shortStageName}</Box>
        <Box width="25%">{duration}</Box>
      </Stack>
    </Stack>
  );
}

const ReplayListItem = memo(function ReplayListItem({
  index,
  numAvailablePlayers,
  replay,
  selectedChipData,
  findUnusedPlayer,
  onClick,
  onOverride,
  resetSelectedChipData,
  elevateChips,
  elevateNames,
}: {
  index: number;
  numAvailablePlayers: number;
  replay: Replay;
  selectedChipData: PlayerOverrides;
  findUnusedPlayer: (
    displayName: string,
    entrantId: number,
    prefix: string,
    pronouns: string,
    overrideSet: Map<string, boolean>,
  ) => PlayerOverrides;
  onClick: (index: number) => void;
  onOverride: () => void;
  resetSelectedChipData: () => void;
  elevateChips: boolean;
  elevateNames: boolean;
}) {
  const onClickCallback = useCallback(() => {
    onClick(index);
  }, [index, onClick]);

  const dateShort = format(replay.startAt, 'yyyy MMM dd');
  const time = format(replay.startAt, 'h:mmaaa');
  const duration = format(
    new Date((replay.lastFrame + 124) / frameMsDivisor),
    "m'm'ss's'",
  );
  const stageName = stageNames.get(replay.stageId) || replay.stageId.toString();

  const displayNamesToShow = replay.players.map((player) => {
    const key = player.port;
    const displayName =
      player.playerOverrides.displayName ||
      (player.playerType === 0 && player.displayName) ||
      '';
    const trophy =
      (player.isWinner && !replay.timeout && (
        <Tooltip arrow placement="top" title="Winner">
          <EmojiEvents style={{ marginLeft: '-4px' }} />
        </Tooltip>
      )) ||
      (player.isWinner && replay.timeout && (
        <Tooltip arrow placement="top" title="Unset as winner (timeout)">
          <IconButton
            onClick={(event) => {
              event.stopPropagation();
              player.isWinner = false;
              onOverride();
            }}
            style={{ color: '#000', margin: '-8px -8px -8px -12px' }}
          >
            <EmojiEvents />
          </IconButton>
        </Tooltip>
      )) ||
      ((player.playerType === 0 || player.playerType === 1) && (
        <Tooltip arrow placement="top" title="Set as winner">
          <IconButton
            onClick={(event) => {
              event.stopPropagation();
              replay.players.forEach((innerPlayer) => {
                innerPlayer.isWinner = false;
              });
              player.isWinner = true;
              onOverride();
            }}
            style={{ color: '#000', margin: '-8px -8px -8px -12px' }}
          >
            <EmojiEventsOutlined />
          </IconButton>
        </Tooltip>
      ));
    return (
      <QuarterSegment key={key}>
        {trophy}
        <Box
          bgcolor={displayName.length > 0 && elevateNames ? 'white' : undefined}
          flexGrow={1}
          sx={{
            zIndex: (theme) =>
              displayName.length > 0 && elevateNames
                ? theme.zIndex.drawer + 2
                : undefined,
          }}
        >
          {displayName.slice(0, 15)}
        </Box>
      </QuarterSegment>
    );
  });

  const playerChips = replay.players.map((player) => {
    const key = player.port;
    if (player.playerType !== 0 && player.playerType !== 1) {
      return <Chip key={key} icon={<HideSource />} style={chipStyle} />;
    }

    const avatar = isValidCharacter(player.externalCharacterId) ? (
      <Avatar
        alt={characterNames.get(player.externalCharacterId)}
        src={getCharacterIcon(player.externalCharacterId, player.costumeIndex)}
        style={{ height: '24px', width: '24px' }}
        variant="square"
      />
    ) : undefined;
    const avatarButton = (player.externalCharacterId === 18 ||
      player.externalCharacterId === 19) && (
      <IconButton
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (player.externalCharacterId === 18) {
            player.externalCharacterId = 19;
          } else {
            player.externalCharacterId = 18;
          }
          onOverride();
        }}
      >
        {avatar}
      </IconButton>
    );
    const name =
      player.playerType === 0
        ? player.connectCode || player.nametag || `P${key}`
        : 'CPU';
    const onClickOrDrop = (
      displayName: string,
      entrantId: number,
      prefix: string,
      pronouns: string,
    ) => {
      player.playerOverrides = { displayName, entrantId, prefix, pronouns };
      const validPlayers = replay.players.filter(
        (otherPlayer) =>
          otherPlayer.playerType === 0 || otherPlayer.playerType === 1,
      );
      validPlayers.forEach((otherPlayer) => {
        if (otherPlayer.port === player.port) {
          return;
        }
        if (
          otherPlayer.playerOverrides.displayName === displayName &&
          otherPlayer.playerOverrides.entrantId === entrantId
        ) {
          otherPlayer.playerOverrides.displayName = '';
          otherPlayer.playerOverrides.entrantId = 0;
        }
      });

      // pigeonhole remaining player if possible
      if (numAvailablePlayers === validPlayers.length) {
        const overrideSet = new Map<string, boolean>();
        const remainingPorts: number[] = [];
        const { teamId } = player;
        const isTeams = numAvailablePlayers === 4 && teamId !== -1;

        // find if there's exactly one hole to pigeon
        const playersToCheck = validPlayers.filter(
          (validPlayer) => !isTeams || validPlayer.teamId === teamId,
        );
        playersToCheck.forEach((playerToCheck) => {
          if (
            playerToCheck.playerOverrides.displayName === '' &&
            playerToCheck.playerOverrides.entrantId === 0
          ) {
            remainingPorts.push(playerToCheck.port);
          } else {
            overrideSet.set(
              playerToCheck.playerOverrides.displayName +
                playerToCheck.playerOverrides.entrantId +
                playerToCheck.playerOverrides.prefix +
                playerToCheck.playerOverrides.pronouns,
              true,
            );
          }
        });

        // find the player to put in the hole
        if (remainingPorts.length === 1) {
          const unusedPlayer = findUnusedPlayer(
            displayName,
            entrantId,
            prefix,
            pronouns,
            overrideSet,
          );
          if (unusedPlayer.displayName && unusedPlayer.entrantId) {
            replay.players[remainingPorts[0] - 1].playerOverrides =
              unusedPlayer;
          }
        }
      }

      onOverride();
      resetSelectedChipData();
    };

    return (
      <DroppableChip
        active={replay.selected}
        avatar={avatarButton || avatar}
        key={key}
        label={name}
        outlined
        selectedChipData={selectedChipData}
        style={chipStyle}
        onClickOrDrop={onClickOrDrop}
        elevate={elevateChips}
      />
    );
  });

  const replayListItemInner = (
    <ListItemButton
      disableGutters
      style={
        replay.invalidReasons.length === 0 ||
        (selectedChipData.displayName && selectedChipData.entrantId) ||
        elevateChips ||
        elevateNames
          ? {}
          : { opacity: '50%' }
      }
      selected={replay.selected}
      onClick={onClickCallback}
    >
      <Checkbox checked={replay.selected} />
      <ReplayContent>
        <Stack direction="row" sx={{ typography: 'caption' }}>
          {displayNamesToShow}
        </Stack>
        <PlayersRow>{playerChips}</PlayersRow>
        <Stack direction="row" sx={{ typography: 'caption' }}>
          <QuarterSegment>{time}</QuarterSegment>
          <QuarterSegment>{stageName}</QuarterSegment>
          <QuarterSegment>{duration}</QuarterSegment>
        </Stack>
        <Stack direction="row" sx={{ typography: 'caption' }}>
          <QuarterSegment>{dateShort}</QuarterSegment>
          <QuarterSegment>{replay.fileName}</QuarterSegment>
        </Stack>
      </ReplayContent>
    </ListItemButton>
  );

  return replay.invalidReasons.length === 0 || replay.selected ? (
    replayListItemInner
  ) : (
    <Tooltip title={replay.invalidReasons.join(' ')}>
      {replayListItemInner}
    </Tooltip>
  );
});

export default function ReplayList({
  dirInit,
  numAvailablePlayers,
  replays,
  selectedChipData,
  findUnusedPlayer,
  onClick,
  onOverride,
  resetSelectedChipData,
  elevate,
  elevateChips,
  elevateNames,
}: {
  dirInit: boolean;
  numAvailablePlayers: number;
  replays: Replay[];
  selectedChipData: PlayerOverrides;
  findUnusedPlayer: (
    displayName: string,
    entrantId: number,
    prefix: string,
    pronouns: string,
    overrideSet: Map<string, boolean>,
  ) => PlayerOverrides;
  onClick: (index: number) => void;
  onOverride: () => void;
  resetSelectedChipData: () => void;
  elevate: boolean;
  elevateChips: boolean;
  elevateNames: boolean;
}) {
  return (
    <List
      disablePadding
      style={{ backgroundColor: 'white' }}
      sx={{
        zIndex: (theme) => (elevate ? theme.zIndex.drawer + 2 : undefined),
      }}
    >
      {replays.length === 0 ? (
        <Alert severity="warning" sx={{ mb: '8px', mt: '8px', pl: '24px' }}>
          {dirInit ? 'Click refresh replays!' : 'No replays in folder.'}
        </Alert>
      ) : (
        replays.map((replay, index) => (
          <ReplayListItem
            key={replay.filePath}
            index={index}
            findUnusedPlayer={findUnusedPlayer}
            numAvailablePlayers={numAvailablePlayers}
            replay={replay}
            selectedChipData={selectedChipData}
            onClick={onClick}
            onOverride={onOverride}
            resetSelectedChipData={resetSelectedChipData}
            elevateChips={elevateChips}
            elevateNames={elevateNames}
          />
        ))
      )}
    </List>
  );
}
