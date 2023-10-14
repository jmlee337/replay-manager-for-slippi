import styled from '@emotion/styled';
import { Box, Stack } from '@mui/material';

const EntrantSection = styled(Stack)`
  align-items: center;
  flex-direction: row;
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
}: {
  entrant1Names: string[];
  entrant1Score: string | null;
  entrant1Win: boolean;
  entrant2Names: string[];
  entrant2Score: string | null;
  fullRoundText: string;
  state: number;
}) {
  let leftScore = '\u00A0';
  let rightScore = '\u00A0';
  if (state === 3) {
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
    <Stack width="100%">
      <Box sx={{ typography: 'caption' }} textAlign="center">
        {fullRoundText}
      </Box>
      <Stack alignItems="center" direction="row" sx={{ typography: 'body2' }}>
        <EntrantSection borderRight={1}>
          <Stack flexGrow={1} textAlign="right">
            <Name>{entrant1Names[0]}</Name>
            {entrant1Names.length > 1 && <Name>{entrant1Names[1]}</Name>}
          </Stack>
          <EntrantScore textAlign="right">{leftScore}</EntrantScore>
        </EntrantSection>
        <EntrantSection borderLeft={1}>
          <EntrantScore>{rightScore}</EntrantScore>
          <Stack flexGrow={1}>
            <Name>{entrant2Names[0]}</Name>
            {entrant2Names.length > 1 && <Name>{entrant2Names[1]}</Name>}
          </Stack>
        </EntrantSection>
      </Stack>
    </Stack>
  );
}