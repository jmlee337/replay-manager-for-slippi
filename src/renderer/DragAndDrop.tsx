import {
  Chip,
  ThemeOptions,
  ThemeProvider,
  Tooltip,
  createTheme,
} from '@mui/material';
import { CSSProperties, DragEvent, ReactElement } from 'react';

export function DraggableChip({
  displayName,
  entrantId,
  selectedChipData,
  setSelectedChipData,
}: {
  displayName: string;
  entrantId: number;
  selectedChipData: { displayName: string; entrantId: number };
  setSelectedChipData: ({
    displayName,
    entrantId,
  }: {
    displayName: string;
    entrantId: number;
  }) => void;
}) {
  const dragStart = (event: DragEvent<HTMLDivElement>) => {
    event.dataTransfer.setData(
      'text/plain',
      `${event.currentTarget.dataset.entrantId}/${event.currentTarget.dataset.displayName}`,
    );
  };
  const selected =
    selectedChipData.displayName === displayName &&
    selectedChipData.entrantId === entrantId;

  return (
    <ThemeProvider
      theme={createTheme({
        components: {
          MuiButtonBase: {
            defaultProps: {
              disableRipple: true,
            },
          },
        },
        palette: {
          primary: {
            contrastText: '#FFF',
            light: '#5BCEFA',
            main: '#5BCEFA',
            dark: '#5BCEFA',
          },
        },
      })}
    >
      <Chip
        color={selected ? 'primary' : undefined}
        data-display-name={displayName}
        data-entrant-id={entrantId.toString(10)}
        draggable
        onClick={() => {
          if (selected) {
            setSelectedChipData({ displayName: '', entrantId: 0 });
          } else {
            setSelectedChipData({ displayName, entrantId });
          }
        }}
        onDragStart={dragStart}
        label={displayName}
        sx={{ zIndex: (theme) => theme.zIndex.drawer + 2 }}
        variant={selected ? 'filled' : 'outlined'}
      />
    </ThemeProvider>
  );
}

export function DroppableChip({
  active,
  avatar,
  label,
  outlined,
  selectedChipData,
  style,
  onClickOrDrop,
}: {
  active: boolean;
  avatar?: ReactElement | undefined;
  label: string;
  outlined: boolean;
  selectedChipData: { displayName: string; entrantId: number };
  style: CSSProperties;
  onClickOrDrop: (displayName: string, entrantId: number) => void;
}) {
  const drop = (event: DragEvent<HTMLDivElement>) => {
    const dataString = event.dataTransfer.getData('text/plain');
    const index = dataString.indexOf('/');
    const newDisplayName = dataString.slice(index + 1);
    const newEntrantId = parseInt(dataString.slice(0, index), 10);
    onClickOrDrop(newDisplayName, newEntrantId);
  };

  const dragEnterOver = (event: DragEvent<HTMLDivElement>) => {
    if (active) {
      event.preventDefault();
    }
  };

  const selectedChip =
    selectedChipData.displayName && selectedChipData.entrantId;

  const themeOptions: ThemeOptions = {
    palette: {
      secondary: {
        contrastText: '#FFF',
        light: '#F5A9B8',
        main: '#F5A9B8',
        dark: '#F5A9B8',
      },
    },
  };
  if (avatar) {
    themeOptions.components = {
      MuiChip: {
        styleOverrides: {
          label: {
            alignItems: 'center',
            display: 'flex',
            flexGrow: 1,
          },
        },
      },
    };
  }

  const chip = (
    <Chip
      avatar={avatar}
      color={active && selectedChip ? 'secondary' : undefined}
      onClick={
        active && selectedChip
          ? (event) => {
              onClickOrDrop(
                selectedChipData.displayName,
                selectedChipData.entrantId,
              );
              event.stopPropagation();
            }
          : undefined
      }
      onDrop={drop}
      onDragEnter={dragEnterOver}
      onDragOver={dragEnterOver}
      label={label}
      style={style}
      sx={
        active && selectedChip
          ? { zIndex: (theme) => theme.zIndex.drawer + 2 }
          : undefined
      }
      variant={outlined && !selectedChip ? 'outlined' : 'filled'}
    />
  );

  return (
    <ThemeProvider theme={createTheme(themeOptions)}>
      {active ? (
        <Tooltip
          arrow
          title={
            selectedChip
              ? `Click to assign ${selectedChipData.displayName}`
              : 'Drop here!'
          }
        >
          {chip}
        </Tooltip>
      ) : (
        chip
      )}
    </ThemeProvider>
  );
}

DroppableChip.defaultProps = {
  avatar: undefined,
};
