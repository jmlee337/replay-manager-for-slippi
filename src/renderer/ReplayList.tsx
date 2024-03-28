import {
  Avatar,
  Checkbox,
  Chip,
  IconButton,
  List,
  ListItemButton,
  Stack,
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
  isValidCharacter,
  stageNames,
} from '../common/constants';
import { DroppableChip } from './DragAndDrop';

const EllipsisText = styled.div`
  flex-grow: 1;
  overflow-x: hidden;
  text-overflow: ellipsis;
`;

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

const characterIcons = require.context('./characters', true);

const ReplayListItem = memo(function ReplayListItem({
  index,
  numAvailablePlayers,
  replay,
  selectedChipData,
  findUnusedPlayer,
  onClick,
  onOverride,
  resetSelectedChipData,
}: {
  index: number;
  numAvailablePlayers: number;
  replay: Replay;
  selectedChipData: { displayName: string; entrantId: number };
  findUnusedPlayer: (
    displayName: string,
    entrantId: number,
    overrideDisplayNameEntrantIds: Map<string, boolean>,
  ) => PlayerOverrides;
  onClick: (index: number) => void;
  onOverride: () => void;
  resetSelectedChipData: () => void;
}) {
  const onClickCallback = useCallback(() => {
    onClick(index);
  }, [index, onClick]);

  const startAtDate = new Date(replay.startAt);
  const dateLong = format(startAtDate, 'MMMM do, yyyy');
  const dateShort = format(startAtDate, 'yyyy MMM dd');
  const time = format(startAtDate, 'h:mmaaa');
  const duration = format(new Date(replay.lastFrame / 0.05994), "m'm'ss's'");
  const stageName = stageNames.get(replay.stageId) || replay.stageId.toString();

  const noOverrideWinner =
    replay.players.findIndex((player) => player.overrideWin) === -1;
  const displayNamesToShow = replay.players.map((player) => {
    const key = player.port;
    const displayName =
      player.playerOverrides.displayName ||
      (player.playerType === 0 && player.displayName);
    const trophy =
      ((player.overrideWin || (noOverrideWinner && player.isWinner)) && (
        <Tooltip arrow placement="top" title="Winner">
          <EmojiEvents style={{ marginLeft: '-4px' }} />
        </Tooltip>
      )) ||
      ((player.playerType === 0 || player.playerType === 1) &&
        noOverrideWinner && (
          <Tooltip arrow placement="top" title="Set as winner">
            <IconButton
              onClick={(event) => {
                event.stopPropagation();
                player.overrideWin = true;
                onOverride();
              }}
              style={{ margin: '-8px -8px -8px -12px' }}
            >
              <EmojiEventsOutlined />
            </IconButton>
          </Tooltip>
        ));
    return (
      <QuarterSegment key={key}>
        {trophy}
        <EllipsisText>{displayName}</EllipsisText>
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
        src={characterIcons(
          `./${player.externalCharacterId}/${player.costumeIndex}/stock.png`,
        )}
        variant="square"
      />
    ) : undefined;
    const name =
      player.playerType === 0
        ? player.connectCode || player.nametag || `P${key}`
        : 'CPU';
    const onClickOrDrop = (displayName: string, entrantId: number) => {
      player.playerOverrides = { displayName, entrantId };
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
        const overrideDisplayNameEntrantIds = new Map<string, boolean>();
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
            overrideDisplayNameEntrantIds.set(
              playerToCheck.playerOverrides.displayName +
                playerToCheck.playerOverrides.entrantId,
              true,
            );
          }
        });

        // find the player to put in the hole
        if (remainingPorts.length === 1) {
          const unusedPlayer = findUnusedPlayer(
            displayName,
            entrantId,
            overrideDisplayNameEntrantIds,
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
        avatar={avatar}
        key={key}
        label={name}
        outlined
        selectedChipData={selectedChipData}
        style={chipStyle}
        onClickOrDrop={onClickOrDrop}
      />
    );
  });

  return (
    <ListItemButton
      disableGutters
      style={
        replay.isValid ||
        (selectedChipData.displayName && selectedChipData.entrantId)
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
          <Tooltip arrow placement="top" title={dateLong}>
            <QuarterSegment>{dateShort}</QuarterSegment>
          </Tooltip>
          <QuarterSegment>{replay.fileName}</QuarterSegment>
        </Stack>
      </ReplayContent>
    </ListItemButton>
  );
});

export default function ReplayList({
  numAvailablePlayers,
  replays,
  selectedChipData,
  findUnusedPlayer,
  onClick,
  onOverride,
  resetSelectedChipData,
}: {
  numAvailablePlayers: number;
  replays: Replay[];
  selectedChipData: { displayName: string; entrantId: number };
  findUnusedPlayer: (
    displayName: string,
    entrantId: number,
    overrideDisplayNameEntrantIds: Map<string, boolean>,
  ) => PlayerOverrides;
  onClick: (index: number) => void;
  onOverride: () => void;
  resetSelectedChipData: () => void;
}) {
  return (
    <List>
      {replays.map((replay, index) => (
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
        />
      ))}
    </List>
  );
}
