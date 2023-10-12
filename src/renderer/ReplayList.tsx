import {
  Avatar,
  Checkbox,
  Chip,
  List,
  ListItemButton,
  ThemeProvider,
  Tooltip,
  Typography,
  createTheme,
} from '@mui/material';
import { EmojiEvents, HideSource } from '@mui/icons-material';
import { memo, useCallback } from 'react';
import styled from '@emotion/styled';
import { format } from 'date-fns';
import { Replay } from '../common/types';
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
  padding: 0 4px;
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

const typographyStyle = {
  display: 'flex',
};

const chipTheme = createTheme({
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
});

const characterIcons = require.context('./characters', true);

const ReplayListItem = memo(function ReplayListItem({
  index,
  replay,
  onClick,
  onOverride,
}: {
  index: number;
  replay: Replay;
  onClick: (index: number) => void;
  onOverride: () => void;
}) {
  const onClickCallback = useCallback(() => {
    onClick(index);
  }, [index, onClick]);

  const startAtDate = new Date(replay.startAt);
  const dateLong = format(startAtDate, 'MMMM do, yyyy');
  const dateShort = format(startAtDate, 'yyyy年MM月dd日');
  const time = format(startAtDate, 'h:mmaaaaa');
  const duration = format(new Date(replay.lastFrame / 0.05994), "m'm'ss's'");
  const stageName = stageNames.get(replay.stageId) || replay.stageId;

  const displayNamesToShow = replay.players.map((player) => {
    const key = player.port;
    const displayName =
      player.overrides.displayName ||
      (player.playerType === 0 && player.displayName);
    const trophy = player.isWinner && (
      <Tooltip arrow placement="top" title="Winner">
        <EmojiEvents />
      </Tooltip>
    );
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
      />
    ) : undefined;
    const name =
      player.playerType === 0
        ? player.connectCode || player.nametag || `P${key}`
        : 'CPU';
    const onDrop = (displayName: string, entrantId: number) => {
      player.overrides = { displayName, entrantId };
      onOverride();
    };

    return (
      <DroppableChip
        active={replay.selected}
        avatar={avatar}
        key={key}
        label={name}
        outlined
        style={chipStyle}
        onDrop={onDrop}
      />
    );
  });

  return (
    <ListItemButton
      style={replay.isValid ? {} : { opacity: '50%' }}
      selected={replay.selected}
      onClick={onClickCallback}
    >
      <Checkbox checked={replay.selected} />
      <ReplayContent>
        <Typography style={typographyStyle} variant="caption">
          {displayNamesToShow}
        </Typography>
        <PlayersRow>
          <ThemeProvider theme={chipTheme}>{playerChips}</ThemeProvider>
        </PlayersRow>
        <Typography style={typographyStyle} variant="subtitle1">
          <QuarterSegment>{time}</QuarterSegment>
          <QuarterSegment>{stageName}</QuarterSegment>
          <QuarterSegment>{duration}</QuarterSegment>
        </Typography>
        <Typography style={typographyStyle} variant="caption">
          <Tooltip arrow placement="top" title={dateLong}>
            <QuarterSegment>{dateShort}</QuarterSegment>
          </Tooltip>
          <QuarterSegment>{replay.fileName}</QuarterSegment>
        </Typography>
      </ReplayContent>
    </ListItemButton>
  );
});

export default function ReplayList({
  replays,
  onClick,
  onOverride,
}: {
  replays: Replay[];
  onClick: (index: number) => void;
  onOverride: () => void;
}) {
  return (
    <List>
      {replays.map((replay, index) => (
        <ReplayListItem
          key={replay.filePath}
          index={index}
          replay={replay}
          onClick={onClick}
          onOverride={onOverride}
        />
      ))}
    </List>
  );
}
