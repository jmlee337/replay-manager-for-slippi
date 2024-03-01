import styled from '@emotion/styled';
import { Backup, HourglassTop } from '@mui/icons-material';
import { Box, Stack, Tooltip } from '@mui/material';

const EntrantNames = styled(Stack)`
  flex-grow: 1;
  min-width: 0;
`;

const EntrantSection = styled(Stack)`
  align-items: center;
  width: 50%;
`;

const EntrantScore = styled(Box)`
  overflow-x: hidden;
  margin: 0 4px;
  text-overflow: ellipsis;
  width: 16px;
`;

const Name = styled.div`
  overflow-x: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export default function SetView({
  entrant1Names,
  entrant1Score,
  entrant1Win,
  entrant2Names,
  entrant2Score,
  fullRoundText,
  state,
  showScores,
}: {
  entrant1Names: string[];
  entrant1Score: string | null;
  entrant1Win: boolean;
  entrant2Names: string[];
  entrant2Score: string | null;
  fullRoundText: string;
  state: number;
  showScores: boolean;
}) {
  let leftScore = '\u00A0';
  let rightScore = '\u00A0';
  if (showScores) {
    if (entrant1Score || entrant1Score) {
      leftScore = entrant1Score || '0';
      rightScore = entrant2Score || '0';
    } else if (entrant1Win) {
      leftScore = 'W';
      rightScore = 'L';
    } else {
      leftScore = 'L';
      rightScore = 'W';
    }
  }

  return (
    <Stack direction="row" width="100%">
      <Box width="20px" />
      <Stack flexGrow={1}>
        <Box sx={{ typography: 'caption' }} textAlign="center">
          {fullRoundText}
        </Box>
        <Stack alignItems="center" direction="row" sx={{ typography: 'body2' }}>
          <EntrantSection borderRight={1} direction="row-reverse">
            <EntrantScore textAlign="right">{leftScore}</EntrantScore>
            <EntrantNames textAlign="right">
              <Name>{entrant1Names[0]}</Name>
              {entrant1Names.length > 1 && <Name>{entrant1Names[1]}</Name>}
            </EntrantNames>
          </EntrantSection>
          <EntrantSection borderLeft={1} direction="row">
            <EntrantScore>{rightScore}</EntrantScore>
            <EntrantNames>
              <Name>{entrant2Names[0]}</Name>
              {entrant2Names.length > 1 && <Name>{entrant2Names[1]}</Name>}
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
        {state === 2 && (
          <Tooltip title="Started">
            <HourglassTop fontSize="small" />
          </Tooltip>
        )}
        {state === 3 && (
          <Tooltip title="Finished">
            <Backup fontSize="small" />
          </Tooltip>
        )}
      </Stack>
    </Stack>
  );
}
