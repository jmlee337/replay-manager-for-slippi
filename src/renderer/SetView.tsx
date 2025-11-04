import React, { useEffect, useState } from 'react';
import styled from '@emotion/styled';
import {
  Backup,
  CheckBox,
  HourglassTop,
  NotificationsActive,
  Tv,
} from '@mui/icons-material';
import { Box, Stack, Tooltip, Typography } from '@mui/material';
import { NameWithHighlight, State, Station, Stream } from '../common/types';
import { highlightColor } from '../common/constants';

const EntrantNames = styled(Stack)`
  width: calc(100% - 22px);
`;

const EntrantSection = styled(Stack)`
  align-items: center;
  box-sizing: border-box;
  width: 50%;
`;

const EntrantScore = styled(Box)`
  overflow-x: hidden;
  margin: 0 4px;
  text-overflow: ellipsis;
  width: 14px;
`;

const Name = styled.div`
  overflow-x: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

function EntrantName({ entrantName }: { entrantName: NameWithHighlight }) {
  if (!entrantName.highlight) {
    return <Name>{entrantName.name}</Name>;
  }

  return (
    <Name>
      <span>{entrantName.name.substring(0, entrantName.highlight.start)}</span>
      <span style={{ backgroundColor: highlightColor }}>
        {entrantName.name.substring(
          entrantName.highlight.start,
          entrantName.highlight.end,
        )}
      </span>
      <span>{entrantName.name.substring(entrantName.highlight.end)}</span>
    </Name>
  );
}

function CallTimer({
  updatedAtMs,
  matchState,
}: {
  updatedAtMs: number;
  matchState: number;
}) {
  const [seconds, setSeconds] = useState<number>(0);
  useEffect(() => {
    const updateTimer = () => {
      const elapsedSeconds = Math.floor((Date.now() - updatedAtMs) / 1000);
      setSeconds(elapsedSeconds);
    };

    updateTimer();
    const timer = window.setInterval(updateTimer, 1000);
    return () => {
      if (timer !== undefined) {
        window.clearInterval(timer);
      }
    };
  }, [updatedAtMs]);

  const min = Math.floor(seconds / 60).toString();

  if (matchState === State.STARTED) {
    return (
      <Tooltip arrow title={`Started ${min} min ago`}>
        <HourglassTop fontSize="small" />
      </Tooltip>
    );
  }
  if (matchState === State.CALLED) {
    return (
      <Tooltip arrow title={`Called ${min} min ago`}>
        <NotificationsActive fontSize="small" />
      </Tooltip>
    );
  }

  return null;
}

export default function SetView({
  entrant1Names,
  entrant1Score,
  entrant1Win,
  entrant2Names,
  entrant2Score,
  fullRoundText,
  showScores,
  state,
  stream,
  station,
  wasReported,
  updatedAtMs,
}: {
  entrant1Names: NameWithHighlight[];
  entrant1Score: number | null;
  entrant1Win: boolean;
  entrant2Names: NameWithHighlight[];
  entrant2Score: number | null;
  fullRoundText: string;
  showScores: boolean;
  state: number;
  stream: Stream | null;
  station: Station | null;
  wasReported: boolean;
  updatedAtMs: number;
}) {
  let leftScore = '\u00A0';
  let rightScore = '\u00A0';
  if (showScores) {
    if (entrant1Score || entrant2Score) {
      leftScore = entrant1Score ? entrant1Score.toString(10) : '0';
      rightScore = entrant2Score ? entrant2Score.toString(10) : '0';
    } else if (entrant1Win) {
      leftScore = 'W';
      rightScore = 'L';
    } else {
      leftScore = 'L';
      rightScore = 'W';
    }
  }

  let streamVerb = 'Queued';
  if (state === State.CALLED) {
    streamVerb = 'Streaming';
  } else if (state === State.COMPLETED) {
    streamVerb = 'Streamed';
  }

  let stationVerb = 'Queued';
  if (state === State.CALLED) {
    stationVerb = 'Playing';
  } else if (state === State.COMPLETED) {
    stationVerb = 'Played';
  }

  return (
    <Stack direction="row" width="100%">
      <Stack alignItems="center" direction="row" width="20px">
        {wasReported && (
          <Tooltip arrow title="Reported">
            <CheckBox />
          </Tooltip>
        )}
        {!wasReported && stream && (
          <Tooltip arrow title={`${streamVerb} on ${stream.path}`}>
            <Tv fontSize="small" />
          </Tooltip>
        )}
        {!wasReported && !stream && station && (
          <Tooltip arrow title={`${stationVerb} at station ${station.number}`}>
            <Typography variant="body1" textAlign="center" width="20px">
              {station.number}
            </Typography>
          </Tooltip>
        )}
      </Stack>
      <Stack width="calc(100% - 40px)">
        <Box sx={{ typography: 'caption' }} textAlign="center">
          {fullRoundText}
        </Box>
        <Stack alignItems="center" direction="row" sx={{ typography: 'body2' }}>
          <EntrantSection borderRight={1} direction="row-reverse">
            <EntrantScore textAlign="right">{leftScore}</EntrantScore>
            <EntrantNames textAlign="right">
              <EntrantName entrantName={entrant1Names[0]} />
              {entrant1Names.length > 1 && (
                <EntrantName entrantName={entrant1Names[1]} />
              )}
            </EntrantNames>
          </EntrantSection>
          <EntrantSection borderLeft={1} direction="row">
            <EntrantScore>{rightScore}</EntrantScore>
            <EntrantNames>
              <EntrantName entrantName={entrant2Names[0]} />
              {entrant2Names.length > 1 && (
                <EntrantName entrantName={entrant2Names[1]} />
              )}
            </EntrantNames>
          </EntrantSection>
        </Stack>
      </Stack>
      <Stack
        alignItems="center"
        direction="row"
        justifyContent="flex-end"
        width="20px"
      >
        {state === State.STARTED && (
          <CallTimer updatedAtMs={updatedAtMs} matchState={State.STARTED} />
        )}
        {state === State.COMPLETED && (
          <Tooltip arrow title="Completed">
            <Backup fontSize="small" />
          </Tooltip>
        )}
        {state === State.CALLED && (
          <CallTimer updatedAtMs={updatedAtMs} matchState={State.CALLED} />
        )}
      </Stack>
    </Stack>
  );
}
