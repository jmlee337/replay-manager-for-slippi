import {
  AdminedTournament,
  Entrant,
  Event,
  Id,
  Participant,
  Phase,
  PhaseGroup,
  Set,
  Sets,
  StartggSet,
  State,
  Station,
  Stream,
  Tournament,
  RendererWave,
  RendererPool,
  SelectedSetChain,
} from '../common/types';

let currentTournament: Tournament | undefined;
const tournamentSlugToEventIds = new Map<string, number[]>();
const idToEvent = new Map<number, Event>();
const eventIdToPhaseIds = new Map<number, number[]>();
const idToPhase = new Map<number, Phase>();
const phaseIdToPhaseGroupIds = new Map<number, number[]>();
const idToPhaseGroup = new Map<number, PhaseGroup>();
const phaseGroupIdToEntrants = new Map<number, Entrant[]>();
const phaseGroupIdToSets = new Map<number, Sets>();
const idToSet = new Map<Id, Set>();
let selectedSetId: Id = 0;
export function getCurrentTournament() {
  if (!currentTournament) {
    return undefined;
  }

  const tournament: Tournament = { ...currentTournament };
  const events = tournamentSlugToEventIds
    .get(tournament.slug)!
    .map((eventId) => {
      const event: Event = { ...idToEvent.get(eventId)! };
      event.phases = (eventIdToPhaseIds.get(eventId) || []).map((phaseId) => {
        const phase: Phase = { ...idToPhase.get(phaseId)! };
        phase.phaseGroups = (phaseIdToPhaseGroupIds.get(phaseId) || []).map(
          (groupId) => {
            const group: PhaseGroup = { ...idToPhaseGroup.get(groupId)! };
            group.entrants = phaseGroupIdToEntrants.get(groupId) || [];
            group.sets = phaseGroupIdToSets.get(groupId) || {
              completedSets: [],
              pendingSets: [],
            };
            return group;
          },
        );
        return phase;
      });
      return event;
    });
  tournament.events = events;
  return tournament;
}

export function getSelectedSet() {
  return idToSet.get(selectedSetId);
}

export function setSelectedSetId(id: Id) {
  selectedSetId = id;
}

export function getSelectedSetChain(
  selectedEventId: number,
  selectedPhaseId: number,
  selectedPhaseGroupId: number,
): SelectedSetChain {
  const event = idToEvent.get(selectedEventId);
  const phase = idToPhase.get(selectedPhaseId);
  const phaseGroup = idToPhaseGroup.get(selectedPhaseGroupId);
  return {
    event:
      event && currentTournament
        ? {
            id: event.id,
            name: event.name,
            slug: event.slug,
            hasSiblings:
              tournamentSlugToEventIds.get(currentTournament.slug)!.length > 1,
          }
        : undefined,
    phase:
      phase && currentTournament
        ? {
            id: phase.id,
            name: phase.name,
            hasSiblings: eventIdToPhaseIds.get(selectedEventId)!.length > 1,
          }
        : undefined,
    phaseGroup:
      phaseGroup && currentTournament
        ? {
            id: phaseGroup.id,
            name: phaseGroup.name,
            bracketType: phaseGroup.bracketType,
            hasSiblings:
              phaseIdToPhaseGroupIds.get(selectedPhaseId)!.length > 1,
            waveId: phaseGroup.waveId,
            winnersTargetPhaseId: phaseGroup.winnersTargetPhaseId,
          }
        : undefined,
  };
}

async function wrappedFetch(
  input: URL | RequestInfo,
  init?: RequestInit | undefined,
): Promise<Response> {
  let response: Response | undefined;
  try {
    response = await fetch(input, init);
  } catch {
    throw new Error('***You may not be connected to the internet***');
  }
  if (!response.ok) {
    if (
      response.status === 500 ||
      response.status === 502 ||
      response.status === 503 ||
      response.status === 504
    ) {
      return new Promise((resolve, reject) => {
        setTimeout(async () => {
          const retryResponse = await fetch(input, init);
          if (!retryResponse.ok) {
            reject(
              new Error(
                `${retryResponse.status} - ${retryResponse.statusText}`,
              ),
            );
          } else {
            resolve(retryResponse);
          }
        }, 1000);
      });
    }
    let keyErr = '';
    if (response.status === 400) {
      keyErr = ' ***start.gg API key invalid!***';
    } else if (response.status === 401) {
      keyErr = ' ***start.gg API key expired!***';
    }
    throw new Error(`${response.status} - ${response.statusText}.${keyErr}`);
  }

  return response;
}

async function fetchGql(key: string, query: string, variables: any) {
  const response = await wrappedFetch('https://api.start.gg/gql/alpha', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await response.json();
  if (Array.isArray(json.errors) && json.errors.length > 0) {
    const message = json.errors[0].message as string;
    const retryMsg =
      message.startsWith('Set not found for id: preview') ||
      message.startsWith('An unknown error has occurred')
        ? '. Refresh the pool and try again.'
        : '';
    throw new Error(`${message}${retryMsg}`);
  }

  return json.data;
}

const GET_TOURNAMENTS_QUERY = `
  query TournamentsQuery {
    currentUser {
      tournaments(query: {perPage: 500, filter: {tournamentView: "admin"}}) {
        nodes {
          hasOfflineEvents
          name
          slug
        }
      }
    }
  }
`;
export async function getTournaments(
  key: string,
): Promise<AdminedTournament[]> {
  const data = await fetchGql(key, GET_TOURNAMENTS_QUERY, {});
  return data.currentUser.tournaments.nodes
    .filter((tournament: any) => tournament.hasOfflineEvents)
    .map((tournament: any) => ({
      slug: tournament.slug.slice(11),
      name: tournament.name,
    }));
}

const playerIdToPronouns = new Map<number, string>();
const idToStream = new Map<number, Stream>();
const idToStation = new Map<number, Station>();
const reportedSetIds = new Map<Id, boolean>();
const setIdToOrdinal = new Map<Id, number | null>();

// 1838376 genesis-9-1
// 2254448 test-tournament-sorry
// 2181889 BattleGateway-42
// 2139098 the-off-season-2-2 1-000-melee-doubles
// state {1: not started, 2: started, 3: completed}
// sort: completed reverse chronological, then call order
export async function getPhaseGroup(
  key: string,
  id: number,
): Promise<PhaseGroup> {
  const response = await wrappedFetch(
    `https://api.start.gg/phase_group/${id}?expand[]=sets&expand[]=entrants&expand[]=seeds`,
  );
  const json = await response.json();
  const phaseGroup = json.entities.groups;
  const {
    groupTypeId: bracketType,
    displayIdentifier,
    state,
    waveId,
    winnersTargetPhaseId,
  } = phaseGroup;
  const isBracketTypeValid =
    bracketType === 1 || // SINGLE_ELIMINATION
    bracketType === 2 || // DOUBLE_ELIMINATION
    bracketType === 3 || // ROUND_ROBIN
    bracketType === 4 || // SWISS
    bracketType === 6; // CUSTOM_SCHEDULE

  const { seeds } = json.entities;
  const entrants: Entrant[] = [];
  if (!isBracketTypeValid || !Array.isArray(seeds) || seeds.length === 0) {
    return {
      id,
      bracketType,
      entrants,
      name: displayIdentifier,
      state,
      sets: { completedSets: [], pendingSets: [] },
      waveId,
      winnersTargetPhaseId,
    };
  }

  const entrantIdToParticipants = new Map<number, Participant[]>();
  const participantsToUpdate = new Map<number, Participant>();
  const missingPlayerParticipants: {
    participantId: number;
    playerId: number;
  }[] = [];
  seeds
    .sort((a, b) => a.groupSeedNum - b.groupSeedNum)
    .forEach((seed) => {
      const { entrantId } = seed;
      if (!Number.isInteger(entrantId)) {
        return;
      }

      const participants: Participant[] = [];
      const actualApiEntrant = Object.values<any>(seed.mutations.entrants).find(
        (entrant) => entrant.id === entrantId,
      );
      if (actualApiEntrant) {
        const { name, participantIds } = actualApiEntrant;
        if (Array.isArray(participantIds) && participantIds.length > 0) {
          participantIds.forEach((participantId) => {
            const participant =
              seed.mutations.participants[participantId.toString()];
            const { gamerTag: displayName, playerId, prefix } = participant;
            const pronouns = playerIdToPronouns.get(playerId) || '';
            const newParticipant: Participant = {
              id: participantId,
              displayName,
              prefix: prefix ?? '',
              pronouns: pronouns ?? '',
            };
            participants.push(newParticipant);
            if (!playerIdToPronouns.has(playerId)) {
              participantsToUpdate.set(participantId, newParticipant);
              missingPlayerParticipants.push({ participantId, playerId });
            }
          });
          if (
            participants.length === 2 &&
            (name as string).startsWith(`${participants[1].displayName} /`)
          ) {
            [participants[0], participants[1]] = [
              participants[1],
              participants[0],
            ];
          }
          entrants.push({
            id: entrantId,
            participants,
          });
          entrantIdToParticipants.set(entrantId, participants);
        }
      }
    });

  if (missingPlayerParticipants.length > 0) {
    do {
      const queryPlayerParticipants = missingPlayerParticipants.slice(0, 500);
      const inner = queryPlayerParticipants.map(
        ({ playerId }) => `
          playerId${playerId}: player(id: ${playerId}) {
            user {
              genderPronoun
            }
          }`,
      );
      const query = `query PlayersQuery {${inner}\n}`;
      // eslint-disable-next-line no-await-in-loop
      const data = await fetchGql(key, query, {});
      queryPlayerParticipants.forEach(({ playerId, participantId }) => {
        const player = data[`playerId${playerId}`];
        const pronouns = player.user?.genderPronoun || '';
        participantsToUpdate.get(participantId)!.pronouns = pronouns;
        playerIdToPronouns.set(playerId, pronouns);
      });
      missingPlayerParticipants.splice(0, 500);
    } while (missingPlayerParticipants.length > 0);
  }

  const completedSets: Set[] = [];
  const pendingSets: Set[] = [];
  const { sets } = json.entities;
  if (Array.isArray(sets)) {
    const reachableSets = sets.filter((set) => !set.unreachable);
    const gfr = reachableSets.find(
      (set) => set.fullRoundText === 'Grand Final Reset',
    );
    if (gfr) {
      gfr.round += 1;
    }

    const idToDEOrdinal = new Map<Id, number>();
    if (bracketType === 2) {
      const idToApiSet = new Map<number, any>();
      reachableSets.forEach((set) => idToApiSet.set(set.id, set));

      const stack: any[] = [];
      const winnersQueue: any[] = [];
      let losersQueue: any[] = [];

      const gfs = reachableSets
        .filter((set) => set.isGF)
        .sort((setA, setB) => setB.round - setA.round);
      if (gfs.length === 2) {
        stack.push(gfs[0]);
        stack.push(gfs[1]);
        // queue losers finals
        if (gfs[1].entrant2PrereqType === 'set') {
          losersQueue.push(idToApiSet.get(gfs[1].entrant2PrereqId));
        }
      } else {
        reachableSets
          .filter((set) => set.wProgressionSeedId && set.lProgressionSeedId)
          .forEach((set) => {
            stack.push(set);
          });
        reachableSets
          .filter((set) => set.wProgressionSeedId && set.round < 0)
          .sort((setA, setB) => setA.round - setB.round)
          .forEach((set) => {
            losersQueue.push(set);
          });
      }

      while (losersQueue.length > 0) {
        const newLosersQueue: any[] = [];
        while (losersQueue.length > 0) {
          const curr = losersQueue.shift();
          stack.push(curr);

          if (curr.entrant1PrereqType === 'set') {
            const pushSet = idToApiSet.get(curr.entrant1PrereqId);
            if (curr.entrant1PrereqCondition === 'winner') {
              newLosersQueue.push(pushSet);
            } else {
              winnersQueue.push(pushSet);
            }
          }
          if (curr.entrant2PrereqType === 'set') {
            const pushSet = idToApiSet.get(curr.entrant2PrereqId);
            if (curr.entrant2PrereqCondition === 'winner') {
              newLosersQueue.push(pushSet);
            } else {
              winnersQueue.push(pushSet);
            }
          }
        }
        while (winnersQueue.length > 0) {
          const curr = winnersQueue.shift();
          stack.push(curr);
        }
        losersQueue = newLosersQueue;
      }

      for (let i = 0; i < stack.length; i += 1) {
        idToDEOrdinal.set(stack[i].id, -i);
      }
    }

    const setsToUpdate = new Map<Id, Set>();
    const missingStreamSets: { setId: Id; streamId: number }[] = [];
    const missingStationSets: { setId: Id; stationId: number }[] = [];
    reachableSets.forEach((set) => {
      const { id: setId } = set as { id: Id };
      let newSet: Set | undefined;
      const updatedAtMs = set.updatedAt * 1000;
      const existingSet = idToSet.get(setId);
      if (existingSet && existingSet.updatedAtMs > updatedAtMs) {
        newSet = existingSet;
        if (newSet.ordinal === null) {
          newSet.ordinal = idToDEOrdinal.get(setId) ?? set.callOrder ?? null;
          setIdToOrdinal.set(setId, newSet.ordinal);
        }
      } else {
        // always skip bye sets
        if (
          set.entrant1PrereqType === 'bye' ||
          set.entrant2PrereqType === 'bye'
        ) {
          idToSet.delete(setId);
          return;
        }

        // always record ordinal for gqlSet conversion
        const ordinal = idToDEOrdinal.get(setId) ?? set.callOrder ?? null;
        setIdToOrdinal.set(setId, ordinal);

        // skip this set if not fully populated
        const { entrant1Id, entrant2Id, streamId, stationId } = set;
        if (!Number.isInteger(entrant1Id) || !Number.isInteger(entrant2Id)) {
          idToSet.delete(setId);
          return;
        }

        const entrant1Participants = entrantIdToParticipants.get(entrant1Id)!;
        const entrant2Participants = entrantIdToParticipants.get(entrant2Id)!;
        const stream =
          streamId === null ? null : idToStream.get(streamId) || null;
        const station =
          stationId === null ? null : idToStation.get(stationId) || null;
        newSet = {
          id: setId,
          state: set.state,
          round: set.round,
          fullRoundText: set.fullRoundText,
          winnerId: set.winnerId,
          entrant1Id,
          entrant1Participants,
          entrant1Score: set.entrant1Score,
          entrant2Id,
          entrant2Participants,
          entrant2Score: set.entrant2Score,
          gameScores: Array.isArray(set.games)
            ? set.games.map((game: any) => ({
                entrant1Score: game.entrant1P1Stocks,
                entrant2Score: game.entrant2P1Stocks,
              }))
            : [],
          stream,
          station,
          ordinal,
          wasReported: reportedSetIds.has(setId),
          updatedAtMs,
          completedAtMs: set.completedAt ? set.completedAt * 1000 : 0,
        };
        idToSet.set(setId, newSet);
        if (Number.isInteger(streamId) && !idToStream.has(streamId)) {
          missingStreamSets.push({ setId, streamId });
          setsToUpdate.set(setId, newSet);
        }
        if (Number.isInteger(stationId) && !idToStation.has(stationId)) {
          missingStationSets.push({ setId, stationId });
          setsToUpdate.set(setId, newSet);
        }
      }
      if (newSet.state === State.COMPLETED) {
        completedSets.push(newSet);
      } else {
        pendingSets.push(newSet);
      }
    });

    if (missingStreamSets.length > 0) {
      do {
        const queryStreamSets = missingStreamSets.slice(0, 500);
        const inner = queryStreamSets.map(
          ({ streamId }) => `
            streamId${streamId}: stream(id: ${streamId}) {
              streamName
              streamSource
            }`,
        );
        const query = `query StreamsQuery {${inner}\n}`;
        // eslint-disable-next-line no-await-in-loop
        const data = await fetchGql(key, query, {});
        queryStreamSets.forEach(({ setId, streamId }) => {
          const gqlStream = data[`streamId${streamId}`];
          if (
            typeof gqlStream.streamSource === 'string' &&
            typeof gqlStream.streamName === 'string'
          ) {
            const stream: Stream = {
              id: streamId,
              domain: gqlStream.streamSource.toLowerCase(),
              path: gqlStream.streamName,
            };
            setsToUpdate.get(setId)!.stream = stream;
            idToStream.set(streamId, stream);
          }
        });
        missingStreamSets.splice(0, 500);
      } while (missingStreamSets.length > 0);
    }
    if (missingStationSets.length > 0) {
      await Promise.all(
        missingStationSets.map(async ({ setId, stationId }) => {
          const stationResponse = await wrappedFetch(
            `https://api.start.gg/station/${stationId}`,
          );
          const stationJson = await stationResponse.json();
          const { number } = stationJson;
          if (Number.isInteger(number) && number > 0) {
            const station: Station = {
              id: stationId,
              number,
            };
            setsToUpdate.get(setId)!.station = station;
            idToStation.set(stationId, station);
          }
        }),
      );
    }
  }
  pendingSets.sort((a, b) => (a.ordinal ?? a.round) - (b.ordinal ?? b.round));
  completedSets.sort((a, b) => (b.ordinal ?? b.round) - (a.ordinal ?? a.round));

  idToPhaseGroup.set(id, {
    id,
    bracketType,
    entrants,
    name: displayIdentifier,
    state,
    sets: { completedSets: [], pendingSets: [] },
    waveId,
    winnersTargetPhaseId,
  });
  phaseGroupIdToEntrants.set(id, entrants);
  phaseGroupIdToSets.set(id, { completedSets, pendingSets });
  return {
    id,
    bracketType,
    entrants,
    name: displayIdentifier,
    state,
    sets: { completedSets, pendingSets },
    waveId,
    winnersTargetPhaseId,
  };
}

export async function getPhase(key: string, id: number, recursive: boolean) {
  const response = await wrappedFetch(
    `https://api.start.gg/phase/${id}?expand[]=groups`,
  );
  const json = await response.json();
  const phaseGroups: PhaseGroup[] = [];
  const phaseGroupIds: number[] = [];
  (json.entities.groups as any[])
    .sort((groupA, groupB) =>
      groupA.displayIdentifier.localeCompare(groupB.displayIdentifier),
    )
    .forEach((group) => {
      const newPhaseGroup: PhaseGroup = {
        id: group.id,
        bracketType: group.groupTypeId,
        entrants: [],
        name: group.displayIdentifier,
        sets: {
          pendingSets: [],
          completedSets: [],
        },
        state: group.state,
        waveId: group.waveId,
        winnersTargetPhaseId: group.winnersTargetPhaseId,
      };
      phaseGroups.push(newPhaseGroup);
      phaseGroupIds.push(group.id);
      idToPhaseGroup.set(group.id, newPhaseGroup);
    });
  const { phase } = json.entities;
  idToPhase.set(id, {
    id: phase.id,
    name: phase.name,
    state: phase.state,
    phaseGroups: [],
  });
  phaseIdToPhaseGroupIds.set(id, phaseGroupIds);

  const phaseGroupIdsWithChildren = phaseGroupIds.filter((phaseGroupId) => {
    const maybeSets = phaseGroupIdToSets.get(phaseGroupId);
    return (
      maybeSets &&
      (maybeSets.completedSets.length > 0 || maybeSets.pendingSets.length > 0)
    );
  });
  if (recursive) {
    await Promise.all(
      phaseGroupIds.map(async (phaseGroupId) =>
        getPhaseGroup(key, phaseGroupId),
      ),
    );
  } else if (phaseGroupIdsWithChildren.length > 0) {
    await Promise.all(
      phaseGroupIdsWithChildren.map(async (phaseGroupId) =>
        getPhaseGroup(key, phaseGroupId),
      ),
    );
  } else if (phaseGroupIds.length === 1) {
    await getPhaseGroup(key, phaseGroupIds[0]);
  }
}

export async function getEvent(key: string, id: number, recursive: boolean) {
  const response = await wrappedFetch(
    `https://api.start.gg/event/${id}?expand[]=phase`,
  );
  const json = await response.json();
  const phases: Phase[] = [];
  const phaseIds: number[] = [];
  (json.entities.phase as any[]).forEach((phase) => {
    const newPhase: Phase = {
      id: phase.id,
      name: phase.name,
      phaseGroups: [],
      state: phase.state,
    };
    phases.push(newPhase);
    phaseIds.push(phase.id);
    idToPhase.set(phase.id, newPhase);
  });
  const { event } = json.entities;
  idToEvent.set(id, {
    id: event.id,
    name: event.name,
    slug: event.slug,
    state: event.state,
    phases: [],
  });
  eventIdToPhaseIds.set(id, phaseIds);

  const phaseIdsWithChildren = phaseIds.filter((phaseId) => {
    const maybePhaseGroupIds = phaseIdToPhaseGroupIds.get(phaseId);
    return maybePhaseGroupIds && maybePhaseGroupIds.length > 0;
  });
  if (recursive) {
    await Promise.all(
      phaseIds.map(async (phaseId) => getPhase(key, phaseId, recursive)),
    );
  } else if (phaseIdsWithChildren.length > 0) {
    await Promise.all(
      phaseIdsWithChildren.map(async (phaseId) =>
        getPhase(key, phaseId, recursive),
      ),
    );
  } else if (phaseIds.length === 1) {
    await getPhase(key, phaseIds[0], recursive);
  }
}
const TOURNAMENT_PARTICIPANTS_QUERY = `
  query TournamentParticipantsQuery($slug: String, $eventIds: [ID], $page: Int) {
    tournament(slug: $slug) {
      participants(query: {page: $page, perPage: 499, filter: {eventIds: $eventIds}}) {
        pageInfo {
          totalPages
        }
        nodes {
          player {
            id
            user {
              genderPronoun
            }
          }
        }
      }
    }
  }
`;
const TOURNAMENT_STREAMS_AND_STATIONS_QUERY = `
  query TournamentStreamsAndStationsQuery($slug: String) {
    tournament(slug: $slug) {
      stations(page: 1, perPage: 500) {
        nodes {
          id
          identifier
          number
        }
      }
      streams {
        id
        streamSource
        streamName
      }
    }
  }
`;
export async function getTournament(
  key: string,
  slugOrShort: string,
  recursive: boolean,
) {
  const response = await wrappedFetch(
    `https://api.start.gg/tournament/${slugOrShort}?expand[]=event`,
  );
  const json = await response.json();
  const { name, locationDisplayName: location } = json.entities.tournament;
  const slug = json.entities.tournament.slug.slice(11);
  const events: Event[] = [];
  const eventIds: number[] = [];
  (json.entities.event as any[])
    .filter((event: any) => {
      const isMelee = event.videogameId === 1;
      const isOffline = !event.isOnline;
      const isSinglesOrDoubles =
        event.teamRosterSize === null ||
        (event.teamRosterSize.minPlayers === 2 &&
          event.teamRosterSize.maxPlayers === 2);
      return isMelee && isOffline && isSinglesOrDoubles;
    })
    .forEach((event: any) => {
      const newEvent: Event = {
        id: event.id,
        name: event.name,
        slug: event.slug,
        state: event.state,
        phases: [],
      };
      events.push(newEvent);
      eventIds.push(event.id);
      idToEvent.set(event.id, newEvent);
    });

  const eventIdsWithChildren = eventIds.filter((eventId) => {
    const maybePhaseIds = eventIdToPhaseIds.get(eventId);
    return maybePhaseIds && maybePhaseIds.length > 0;
  });

  const streamsAndStationsPromise = fetchGql(
    key,
    TOURNAMENT_STREAMS_AND_STATIONS_QUERY,
    { slug },
  );

  if (eventIdsWithChildren.length === 0) {
    let nextData;
    let page = 1;
    do {
      // eslint-disable-next-line no-await-in-loop
      nextData = await fetchGql(key, TOURNAMENT_PARTICIPANTS_QUERY, {
        page,
        slug,
        eventIds: events.map((event) => event.id),
      });
      const { nodes } = nextData.tournament.participants;
      if (Array.isArray(nodes)) {
        nodes.forEach((participant) => {
          playerIdToPronouns.set(
            participant.player.id,
            participant.player.user?.genderPronoun || '',
          );
        });
      }
      page += 1;
    } while (page <= nextData.tournament.participants.pageInfo.totalPages);
  }

  const streamsAndStationsData = await streamsAndStationsPromise;
  const { streams } = streamsAndStationsData.tournament;
  idToStream.clear();
  if (Array.isArray(streams)) {
    streams.forEach((stream) => {
      if (
        Number.isInteger(stream.id) &&
        stream.id > 0 &&
        typeof stream.streamSource === 'string' &&
        typeof stream.streamName === 'string'
      ) {
        idToStream.set(stream.id, {
          id: stream.id,
          domain: stream.streamSource.toLowerCase(),
          path: stream.streamName,
        });
      }
    });
  }
  const stations = streamsAndStationsData.tournament.stations.nodes;
  idToStation.clear();
  if (Array.isArray(stations)) {
    stations.forEach((station) => {
      const { id, number } = station;
      if (
        Number.isInteger(id) &&
        id > 0 &&
        Number.isInteger(number) &&
        number > 0
      ) {
        idToStation.set(id, { id, number });
      }
    });
  }

  currentTournament = {
    name,
    slug,
    location,
    events: [],
    stations: Array.from(idToStation.values()).sort(
      (a, b) => a.number - b.number,
    ),
    streams: Array.from(idToStream.values()).sort((a, b) => {
      if (a.domain === b.domain) {
        return a.path.localeCompare(b.path);
      }
      return a.domain.localeCompare(b.domain);
    }),
  };
  tournamentSlugToEventIds.set(slug, eventIds);
  if (recursive) {
    await Promise.all(
      eventIds.map(async (eventId) => getEvent(key, eventId, recursive)),
    );
  } else if (eventIdsWithChildren.length > 0) {
    await Promise.all(
      eventIdsWithChildren.map(async (eventId) =>
        getEvent(key, eventId, recursive),
      ),
    );
  } else if (eventIds.length === 1) {
    await getEvent(key, eventIds[0], recursive);
  }
}

export async function getPoolsByWave(key: string) {
  if (!currentTournament) {
    return [];
  }

  await getTournament(key, currentTournament.slug, true);
  const waveIdToPools = new Map<number, RendererPool[]>();
  const noWavePools: (RendererPool & {
    eventId: number;
    phaseId: number;
    winnersTargetPhaseId: number | null;
  })[] = [];
  // eslint-disable-next-line no-restricted-syntax
  for (const eventId of tournamentSlugToEventIds.get(currentTournament.slug) ??
    []) {
    const event = idToEvent.get(eventId);
    if (event) {
      const phaseIds = eventIdToPhaseIds.get(eventId) ?? [];
      // eslint-disable-next-line no-restricted-syntax
      for (const phaseId of phaseIds) {
        const phase = idToPhase.get(phaseId);
        if (phase) {
          const parentName = phaseIds.length > 1 ? phase.name : event.name;
          const phaseGroupIds = phaseIdToPhaseGroupIds.get(phaseId) ?? [];
          // eslint-disable-next-line no-restricted-syntax
          for (const phaseGroupId of phaseGroupIds) {
            const phaseGroup = idToPhaseGroup.get(phaseGroupId);
            if (phaseGroup) {
              if (phaseGroup.waveId) {
                const wavePools = waveIdToPools.get(phaseGroup.waveId) ?? [];
                wavePools.push(phaseGroup);
                waveIdToPools.set(phaseGroup.waveId, wavePools);
              } else {
                noWavePools.push({
                  id: phaseGroup.id,
                  entrants: phaseGroup.entrants,
                  name:
                    phaseGroupIds.length > 1
                      ? `${parentName}, ${phaseGroup.name}`
                      : parentName,
                  winnersTargetPhaseId: phaseGroup.winnersTargetPhaseId,
                  eventId,
                  phaseId,
                });
              }
            }
          }
        }
      }
    }
  }

  noWavePools.sort((a, b) => {
    if (a.eventId !== b.eventId) {
      return a.eventId - b.eventId;
    }

    if (a.winnersTargetPhaseId !== null && b.winnersTargetPhaseId === null) {
      return -1;
    }
    if (a.winnersTargetPhaseId === null && b.winnersTargetPhaseId !== null) {
      return 1;
    }
    if (
      a.winnersTargetPhaseId !== null &&
      b.winnersTargetPhaseId !== null &&
      a.winnersTargetPhaseId !== b.winnersTargetPhaseId
    ) {
      if (a.winnersTargetPhaseId === b.phaseId) {
        return -1;
      }
      if (a.phaseId === b.winnersTargetPhaseId) {
        return 1;
      }
      return a.winnersTargetPhaseId - b.winnersTargetPhaseId;
    }

    if (a.phaseId !== b.phaseId) {
      return a.phaseId - b.phaseId;
    }

    return a.name.length === b.name.length
      ? a.name.localeCompare(b.name)
      : a.name.length - b.name.length;
  });

  Array.from(waveIdToPools.values()).forEach((phaseGroups) =>
    phaseGroups.sort((a, b) =>
      a.name.length === b.name.length
        ? a.name.localeCompare(b.name)
        : a.name.length - b.name.length,
    ),
  );

  return [
    ...Array.from(waveIdToPools.keys())
      .sort((a, b) => a - b)
      .map(
        (waveId): RendererWave => ({
          id: waveId,
          pools: waveIdToPools.get(waveId)!,
        }),
      ),
    {
      id: 0,
      pools: noWavePools,
    },
  ];
}

const GQL_SET_INNER = `
  completedAt
  id
  fullRoundText
  games {
    entrant1Score
    entrant2Score
  }
  round
  slots {
    entrant {
      id
      name
      participants {
        id
        gamerTag
        prefix
        player {
          user {
            genderPronoun
          }
        }
      }
    }
    standing {
      stats {
        score {
          displayValue
        }
      }
    }
  }
  state
  stream {
    id
    streamName
    streamSource
  }
  station {
    id
    number
  }
  updatedAt
  winnerId
`;
type ApiParticipant = {
  id: number;
  gamerTag: string;
  prefix: string | null;
  player: {
    user: {
      genderPronoun: string | null;
    } | null;
  };
};
function gqlParticipantToParticipant(participant: ApiParticipant): Participant {
  return {
    id: participant.id,
    displayName: participant.gamerTag,
    prefix: participant.prefix || '',
    pronouns: participant.player.user?.genderPronoun || '',
  };
}
function gqlSetToSet(set: any): Set {
  const slot1 = set.slots[0];
  const slot2 = set.slots[1];
  const entrant1Participants: Participant[] = slot1.entrant.participants.map(
    gqlParticipantToParticipant,
  );
  if (
    entrant1Participants.length === 2 &&
    (slot1.entrant.name as string).startsWith(
      `${entrant1Participants[1].displayName} /`,
    )
  ) {
    [entrant1Participants[0], entrant1Participants[1]] = [
      entrant1Participants[1],
      entrant1Participants[0],
    ];
  }
  const entrant2Participants: Participant[] = slot2.entrant.participants.map(
    gqlParticipantToParticipant,
  );
  if (
    entrant2Participants.length === 2 &&
    (slot2.entrant.name as string).startsWith(
      `${entrant2Participants[1].displayName} /`,
    )
  ) {
    [entrant2Participants[0], entrant2Participants[1]] = [
      entrant2Participants[1],
      entrant2Participants[0],
    ];
  }
  const entrant1DisplayValue =
    (slot1.standing?.stats?.score?.displayValue as string) || null;
  const entrant2DisplayValue =
    (slot2.standing?.stats?.score?.displayValue as string) || null;
  return {
    id: set.id,
    state: set.state,
    round:
      set.fullRoundText === 'Grand Final Reset' ? set.round + 1 : set.round,
    fullRoundText: set.fullRoundText,
    winnerId: set.winnerId,
    entrant1Id: slot1.entrant.id,
    entrant1Participants,
    entrant1Score: entrant1DisplayValue
      ? Number.parseInt(entrant1DisplayValue, 10)
      : null,
    entrant2Id: slot2.entrant.id,
    entrant2Participants,
    entrant2Score: entrant2DisplayValue
      ? Number.parseInt(entrant2DisplayValue, 10)
      : null,
    gameScores: Array.isArray(set.games)
      ? set.games.map((game: any) => ({
          entrant1Score: game.entrant1Score ?? 0,
          entrant2Score: game.entrant2Score ?? 0,
        }))
      : [],
    stream:
      set.stream?.id && set.stream?.streamSource && set.stream?.streamName
        ? {
            id: set.stream.id,
            domain: set.stream.streamSource.toLowerCase(),
            path: set.stream.streamName,
          }
        : null,
    station:
      set.station?.id && set.station?.number
        ? { id: set.station.id, number: set.station.number }
        : null,
    ordinal: setIdToOrdinal.get(set.id) ?? null,
    wasReported: reportedSetIds.has(set.id),
    updatedAtMs: set.updatedAt ? set.updatedAt * 1000 : 0,
    completedAtMs: set.completedAt ? set.completedAt * 1000 : 0,
  };
}

const ASSIGN_STREAM_MUTATION = `
  mutation AssignStream($setId: ID!, $streamId: ID!) {
    assignStream(setId: $setId, streamId: $streamId) {${GQL_SET_INNER}}
  }
`;
export async function assignStream(key: string, setId: Id, streamId: number) {
  const data = await fetchGql(key, ASSIGN_STREAM_MUTATION, { setId, streamId });
  const updatedSet = gqlSetToSet(data.assignStream);
  idToSet.set(updatedSet.id, updatedSet);
  setSelectedSetId(updatedSet.id);
}

const ASSIGN_STATION_MUTATION = `
  mutation AssignStation($setId: ID!, $stationId: ID!) {
    assignStation(setId: $setId, stationId: $stationId) {${GQL_SET_INNER}}
  }
`;
export async function assignStation(key: string, setId: Id, stationId: number) {
  const data = await fetchGql(key, ASSIGN_STATION_MUTATION, {
    setId,
    stationId,
  });
  const updatedSet = gqlSetToSet(data.assignStation);
  idToSet.set(updatedSet.id, updatedSet);
  setSelectedSetId(updatedSet.id);
}

const RESET_SET_MUTATION = `
  mutation ResetSet($setId: ID!) {
    resetSet(setId: $setId) {${GQL_SET_INNER}}
  }
`;
export async function resetSet(key: string, setId: number) {
  const data = await fetchGql(key, RESET_SET_MUTATION, { setId });
  const updatedSet = gqlSetToSet(data.resetSet);
  idToSet.set(updatedSet.id, updatedSet);
  setSelectedSetId(updatedSet.id);
}

const MARK_SET_CALLED_MUTATION = `
  mutation MarkSetCalled($setId: ID!) {
    markSetCalled(setId: $setId) {${GQL_SET_INNER}}
  }
`;
export async function callSet(key: string, setId: Id) {
  try {
    const data = await fetchGql(key, MARK_SET_CALLED_MUTATION, { setId });
    const updatedSet = gqlSetToSet(data.markSetCalled);
    idToSet.set(updatedSet.id, updatedSet);
    setSelectedSetId(updatedSet.id);
  } catch (e: any) {
    if (e.message !== 'Set is already called') {
      throw e;
    }
  }
}

const MARK_SET_IN_PROGRESS_MUTATION = `
  mutation MarkSetInProgress($setId: ID!) {
    markSetInProgress(setId: $setId) {${GQL_SET_INNER}}
  }
`;
export async function startSet(key: string, setId: Id) {
  try {
    const data = await fetchGql(key, MARK_SET_IN_PROGRESS_MUTATION, { setId });
    const updatedSet = gqlSetToSet(data.markSetInProgress);
    idToSet.set(updatedSet.id, updatedSet);
    setSelectedSetId(updatedSet.id);
  } catch (e: any) {
    if (e.message !== 'Set is already started') {
      throw e;
    }
  }
}

const REPORT_BRACKET_SET_MUTATION = `
  mutation ReportBracketSet($setId: ID!, $winnerId: ID, $isDQ: Boolean, $gameData: [BracketSetGameDataInput]) {
    reportBracketSet(setId: $setId, isDQ: $isDQ, winnerId: $winnerId, gameData: $gameData) {${GQL_SET_INNER}}
  }
`;
export async function reportSet(
  key: string,
  set: StartggSet,
  selectedPhaseGroupId: number,
) {
  const data = await fetchGql(key, REPORT_BRACKET_SET_MUTATION, set);
  const filteredSets = (data.reportBracketSet as any[]).filter(
    (bracketSet) => bracketSet.slots[0].entrant && bracketSet.slots[1].entrant,
  );
  if (
    filteredSets.some((filteredSet) => !setIdToOrdinal.has(filteredSet.id)) &&
    selectedPhaseGroupId
  ) {
    await getPhaseGroup(key, selectedPhaseGroupId);
  }
  const updatedSets = filteredSets.map((bracketSet) => {
    const updatedSet = gqlSetToSet(bracketSet);
    idToSet.set(updatedSet.id, updatedSet);
    return updatedSet;
  });
  let reportedSet = updatedSets.find(
    (updatedSet) => updatedSet.id === set.setId,
  );
  if (!reportedSet && typeof set.setId === 'string') {
    const originalSet = idToSet.get(set.setId);
    if (originalSet) {
      const candidateReportedSets = updatedSets.filter(
        (updatedSet) =>
          updatedSet.state === State.COMPLETED &&
          updatedSet.entrant1Id === originalSet.entrant1Id &&
          updatedSet.entrant2Id === originalSet.entrant2Id &&
          updatedSet.round === originalSet.round,
      );
      if (candidateReportedSets.length === 1) {
        [reportedSet] = candidateReportedSets;
      }
    }
  }
  reportedSetIds.set(reportedSet ? reportedSet.id : set.setId, true);
  setSelectedSetId(reportedSet ? reportedSet.id : set.setId);
  return reportedSet;
}

const UPDATE_BRACKET_SET_MUTATION = `
  mutation UpdateBracketSet($setId: ID!, $winnerId: ID, $isDQ: Boolean, $gameData: [BracketSetGameDataInput]) {
    updateBracketSet(setId: $setId, isDQ: $isDQ, winnerId: $winnerId, gameData: $gameData) {${GQL_SET_INNER}}
  }
`;
export async function updateSet(key: string, set: StartggSet) {
  const data = await fetchGql(key, UPDATE_BRACKET_SET_MUTATION, set);
  if (!data.updateBracketSet) {
    return undefined;
  }

  const updatedSet = gqlSetToSet(data.updateBracketSet);
  reportedSetIds.set(updatedSet.id, true);
  idToSet.set(updatedSet.id, updatedSet);
  setSelectedSetId(updatedSet.id);
  return updatedSet;
}
