import {
  Chip,
  ThemeOptions,
  ThemeProvider,
  Tooltip,
  createTheme,
} from '@mui/material';
import { CSSProperties, DragEvent, ReactElement } from 'react';
import { NameWithHighlight, PlayerOverrides } from '../common/types';
import { highlightColor } from '../common/constants';

function Name({ nameWithHighlight }: { nameWithHighlight: NameWithHighlight }) {
  if (!nameWithHighlight.highlight) {
    return nameWithHighlight.name;
  }

  return (
    <>
      <span>
        {nameWithHighlight.name.substring(0, nameWithHighlight.highlight.start)}
      </span>
      <span style={{ backgroundColor: highlightColor }}>
        {nameWithHighlight.name.substring(
          nameWithHighlight.highlight.start,
          nameWithHighlight.highlight.end,
        )}
      </span>
      <span>
        {nameWithHighlight.name.substring(nameWithHighlight.highlight.end)}
      </span>
    </>
  );
}

export function DraggableChip({
  entrantId,
  nameWithHighlight,
  prefix,
  pronouns,
  selectedChipData,
  setSelectedChipData,
  elevate,
}: {
  entrantId: number;
  nameWithHighlight: NameWithHighlight;
  prefix: string;
  pronouns: string;
  selectedChipData: PlayerOverrides;
  setSelectedChipData: ({
    displayName,
    entrantId,
    prefix,
    pronouns,
  }: {
    displayName: string;
    entrantId: number;
    prefix: string;
    pronouns: string;
  }) => void;
  elevate?: boolean;
}) {
  const dragStart = (event: DragEvent<HTMLDivElement>) => {
    event.dataTransfer.setData(
      'text/plain',
      JSON.stringify({
        displayName: event.currentTarget.dataset.displayName,
        entrantId: event.currentTarget.dataset.entrantId,
        prefix: event.currentTarget.dataset.prefix,
        pronouns: event.currentTarget.dataset.pronouns,
      }),
    );
  };
  const selected =
    selectedChipData.displayName === nameWithHighlight.name &&
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
          action: {
            hover: elevate ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.04)',
          },
        },
      })}
    >
      <Chip
        color={selected ? 'primary' : undefined}
        data-display-name={nameWithHighlight.name}
        data-entrant-id={entrantId.toString(10)}
        data-prefix={prefix}
        data-pronouns={pronouns}
        draggable
        onClick={() => {
          if (selected) {
            setSelectedChipData({
              displayName: '',
              entrantId: 0,
              prefix: '',
              pronouns: '',
            });
          } else {
            setSelectedChipData({
              displayName: nameWithHighlight.name,
              entrantId,
              prefix,
              pronouns,
            });
          }
        }}
        onDragStart={dragStart}
        label={<Name nameWithHighlight={nameWithHighlight} />}
        sx={{
          backgroundColor: !selected && elevate ? 'white' : undefined,
          zIndex: (theme) => {
            if (selected) {
              return theme.zIndex.drawer + 4;
            }
            if (elevate) {
              return theme.zIndex.drawer + 2;
            }
            return undefined;
          },
        }}
        variant={selected ? 'filled' : 'outlined'}
      />
    </ThemeProvider>
  );
}

DraggableChip.defaultProps = {
  elevate: false,
};

export function DroppableChip({
  active,
  avatar,
  label,
  outlined,
  selectedChipData,
  style,
  onClickOrDrop,
  elevate,
}: {
  active: boolean;
  avatar?: ReactElement | undefined;
  label: string;
  outlined: boolean;
  selectedChipData: PlayerOverrides;
  style: CSSProperties;
  onClickOrDrop: (
    displayName: string,
    entrantId: number,
    prefix: string,
    pronouns: string,
  ) => void;
  elevate?: boolean;
}) {
  const drop = (event: DragEvent<HTMLDivElement>) => {
    const json = JSON.parse(event.dataTransfer.getData('text/plain'));
    onClickOrDrop(
      json.displayName,
      parseInt(json.entrantId, 10),
      json.prefix,
      json.pronouns,
    );
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
                selectedChipData.prefix,
                selectedChipData.pronouns,
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
      sx={{
        backgroundColor:
          active && elevate && !selectedChip ? 'white' : undefined,
        zIndex: (theme) => {
          if (active && selectedChip) {
            return theme.zIndex.drawer + 4;
          }
          if (active && elevate) {
            return theme.zIndex.drawer + 2;
          }
          return undefined;
        },
      }}
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
  elevate: false,
};
