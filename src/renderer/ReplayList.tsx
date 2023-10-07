import {
  Avatar,
  Checkbox,
  Chip,
  List,
  ListItemButton,
  ThemeProvider,
  Typography,
  createTheme,
} from '@mui/material';
import { EmojiEvents, HideSource } from '@mui/icons-material';
import { memo, useCallback } from 'react';
import styled from '@emotion/styled';
import { format } from 'date-fns';
import { Replay } from '../common/types';
import { stageNames } from '../common/constants';

const PlayersRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const ReplayContent = styled.div`
  display: flex;
  flex-direction: column;
  flex-grow: 1;
`;

const SpanGrow = styled.span`
  flex-grow: 1;
`;

const TextBlock = styled.div`
  min-width: 25%;
`;

const chipStyle = {
  width: '24%',
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

const ReplayListItem = memo(function ReplayListItem({
  index,
  replay,
  onClick,
}: {
  index: number;
  replay: Replay;
  onClick: (index: number) => void;
}) {
  const onClickCallback = useCallback(() => {
    onClick(index);
  }, [index, onClick]);

  const startAtDate = new Date(replay.startAt);
  const date = format(startAtDate, 'yyyy年MM月dd日');
  const time = format(startAtDate, 'h:mmaaaaa');
  const duration = format(new Date(replay.lastFrame / 0.05994), "m'm'ss's'");
  const stageName = stageNames.get(replay.stageId) || replay.stageId;

  const playerChips = replay.players.map((player) => {
    const key = player.port;
    if (player.playerType !== 0 && player.playerType !== 1) {
      return <Chip key={key} icon={<HideSource />} style={chipStyle} />;
    }

    const avatar = (
      <Avatar>
        {player.externalCharacterId}/{player.costumeIndex}
      </Avatar>
    );
    const name = player.playerType === 0 ? `P${key}` : 'CPU';
    const label = (
      <>
        <SpanGrow>{name}</SpanGrow>
        {player.isWinner && <EmojiEvents />}
      </>
    );
    return (
      <Chip
        avatar={avatar}
        key={key}
        label={label}
        style={chipStyle}
        variant={player.playerType === 0 ? 'outlined' : 'filled'}
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
        <PlayersRow>
          <ThemeProvider theme={chipTheme}>{playerChips}</ThemeProvider>
        </PlayersRow>
        <Typography style={typographyStyle} variant="subtitle1">
          <TextBlock>{stageName}</TextBlock>
          <TextBlock>{duration}</TextBlock>
          <TextBlock>{time}</TextBlock>
        </Typography>
        <Typography style={typographyStyle} variant="caption">
          <TextBlock>{date}</TextBlock>
          <TextBlock>{replay.fileName}</TextBlock>
        </Typography>
      </ReplayContent>
    </ListItemButton>
  );
});

export default function ReplayList({
  replays,
  onClick,
}: {
  replays: Replay[];
  onClick: (index: number) => void;
}) {
  return (
    <List>
      {replays.map((replay, index) => (
        <ReplayListItem
          key={replay.filePath}
          index={index}
          replay={replay}
          onClick={onClick}
        />
      ))}
    </List>
  );
}
