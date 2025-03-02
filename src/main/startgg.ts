import {
  AdminedTournament,
  Entrant,
  Event,
  Participant,
  Phase,
  PhaseGroup,
  SelectedEvent,
  SelectedPhase,
  SelectedPhaseGroup,
  Set,
  Sets,
  StartggSet,
  State,
  Stream,
  Tournament,
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
const idToSet = new Map<number | string, Set>();
let selectedSetId: number | string = 0;
let selectedPhaseGroupId = 0;
let selectedPhaseId = 0;
let selectedEventId = 0;
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

export function setSelectedSetId(id: number | string) {
  selectedSetId = id;
}

export function getSelectedSetChain(): {
  event?: SelectedEvent;
  phase?: SelectedPhase;
  phaseGroup?: SelectedPhaseGroup;
} {
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
          }
        : undefined,
  };
}

export function setSelectedSetChain(
  eventId: number,
  phaseId: number,
  phaseGroupId: number,
) {
  selectedEventId = eventId;
  selectedPhaseId = phaseId;
  selectedPhaseGroupId = phaseGroupId;
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
  if (json.errors) {
    throw new Error(json.errors[0].message);
  }

  return json.data;
}

const GET_TOURNAMENTS_QUERY = `
  query TournamentsQuery {
    currentUser {
      tournaments(query: {perPage: 500, filter: {tournamentView: "admin"}}) {
        nodes {
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
  return data.currentUser.tournaments.nodes.map((tournament: any) => ({
    slug: tournament.slug.slice(11),
    name: tournament.name,
  }));
}

function getDomain(streamSource: number) {
  switch (streamSource) {
    case 1:
      return 'twitch';
    case 2:
      return 'hitbox';
    case 3:
      return 'streamme';
    case 4:
      return 'mixer';
    case 5:
      return 'youtube';
    default:
      return 'unknown';
  }
}

const playerIdToPronouns = new Map<number, string>();
const idToStream = new Map<number, Stream>();
const reportedSetIds = new Map<number | string, boolean>();
const setIdToOrdinal = new Map<number | string, number | null>();

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
    `https://api.smash.gg/phase_group/${id}?expand[]=sets&expand[]=entrants`,
  );
  const json = await response.json();
  const phaseGroup = json.entities.groups;
  const {
    groupTypeId: bracketType,
    displayIdentifier: name,
    state,
    waveId,
  } = phaseGroup;
  const isBracketTypeValid =
    bracketType === 1 || // SINGLE_ELIMINATION
    bracketType === 2 || // DOUBLE_ELIMINATION
    bracketType === 3 || // ROUND_ROBIN
    bracketType === 4 || // SWISS
    bracketType === 6; // CUSTOM_SCHEDULE

  const { entrants: apiEntrants } = json.entities;
  const entrants: Entrant[] = [];
  if (
    !isBracketTypeValid ||
    !Array.isArray(apiEntrants) ||
    apiEntrants.length === 0
  ) {
    return {
      id,
      bracketType,
      entrants,
      name,
      state,
      sets: { completedSets: [], pendingSets: [] },
      waveId,
    };
  }

  const entrantIdToParticipants = new Map<number, Participant[]>();
  const participantsToUpdate = new Map<number, Participant>();
  const missingPlayerParticipants: {
    participantId: number;
    playerId: number;
  }[] = [];
  apiEntrants.forEach((entrant) => {
    const { id: entrantId } = entrant;
    if (!Number.isInteger(id)) {
      return;
    }

    const participants: Participant[] = [];
    Array.from(Object.values(entrant.mutations.participants)).forEach(
      (participant: any) => {
        const {
          id: participantId,
          gamerTag: displayName,
          playerId,
          prefix,
        } = participant;
        const pronouns = playerIdToPronouns.get(playerId) || '';
        const newParticipant: Participant = {
          displayName,
          prefix,
          pronouns,
        };
        participants.push(newParticipant);
        if (!playerIdToPronouns.has(playerId)) {
          participantsToUpdate.set(participantId, newParticipant);
          missingPlayerParticipants.push({ participantId, playerId });
        }
      },
    );
    entrants.push({
      id: entrantId,
      participants,
    });
    entrantIdToParticipants.set(entrantId, participants);
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

    const idToDEOrdinal = new Map<number | string, number>();
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

    const setsToUpdate = new Map<number | string, Set>();
    const missingStreamSets: { setId: number | string; streamId: number }[] =
      [];
    reachableSets.forEach((set) => {
      const { id: setId } = set as { id: number | string };
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
        const { entrant1Id, entrant2Id, streamId } = set;
        if (!Number.isInteger(entrant1Id) || !Number.isInteger(entrant2Id)) {
          idToSet.delete(setId);
          return;
        }

        const entrant1Participants = entrantIdToParticipants.get(entrant1Id)!;
        const entrant2Participants = entrantIdToParticipants.get(entrant2Id)!;
        const stream =
          streamId === null ? null : idToStream.get(streamId) || null;
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
          ordinal,
          wasReported: reportedSetIds.has(setId),
          updatedAtMs,
        };
        idToSet.set(setId, newSet);
        if (Number.isInteger(streamId) && !idToStream.has(streamId)) {
          missingStreamSets.push({ setId, streamId });
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
          const stream: Stream = {
            domain: gqlStream.streamSource.toLowerCase(),
            path: gqlStream.streamName,
          };
          setsToUpdate.get(setId)!.stream = stream;
          idToStream.set(streamId, stream);
        });
        missingStreamSets.splice(0, 500);
      } while (missingStreamSets.length > 0);
    }
  }
  pendingSets.sort((a, b) => (a.ordinal ?? a.round) - (b.ordinal ?? b.round));
  completedSets.sort((a, b) => (b.ordinal ?? b.round) - (a.ordinal ?? a.round));

  idToPhaseGroup.set(id, {
    id,
    bracketType,
    entrants: [],
    name,
    state,
    sets: { completedSets: [], pendingSets: [] },
    waveId,
  });
  phaseGroupIdToEntrants.set(id, entrants);
  phaseGroupIdToSets.set(id, { completedSets, pendingSets });
  return {
    id,
    bracketType,
    entrants,
    name,
    state,
    sets: { completedSets, pendingSets },
    waveId,
  };
}

export async function getPhase(key: string, id: number, recursive: boolean) {
  const response = await wrappedFetch(
    `https://api.smash.gg/phase/${id}?expand[]=groups`,
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
    `https://api.smash.gg/event/${id}?expand[]=phase`,
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
    isOnline: event.isOnline,
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
export async function getTournament(
  key: string,
  slug: string,
  recursive: boolean,
) {
  const response = await wrappedFetch(
    `https://api.smash.gg/tournament/${slug}?expand[]=event`,
  );
  const json = await response.json();
  const { id, name, locationDisplayName: location } = json.entities.tournament;
  const events: Event[] = [];
  const eventIds: number[] = [];
  (json.entities.event as any[])
    .filter((event: any) => {
      const isMelee = event.videogameId === 1;
      const isSinglesOrDoubles =
        event.teamRosterSize === null ||
        (event.teamRosterSize.minPlayers === 2 &&
          event.teamRosterSize.maxPlayers === 2);
      return isMelee && isSinglesOrDoubles;
    })
    .forEach((event: any) => {
      const newEvent: Event = {
        id: event.id,
        name: event.name,
        slug: event.slug,
        isOnline: event.isOnline,
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

  if (eventIdsWithChildren.length === 0) {
    const streamsPromise = wrappedFetch(
      `https://api.smash.gg/station_queue/${id}`,
    );
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

    const streamsResponse = await streamsPromise;
    const streamsJson = await streamsResponse.json();
    const streams = streamsJson.data?.entities?.stream;
    if (Array.isArray(streams)) {
      streams.forEach((stream) => {
        idToStream.set(stream.id, {
          domain: getDomain(stream.streamSource),
          path: stream.streamName,
        });
      });
    }
  }

  currentTournament = { name, slug, location, events: [] };
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

const GQL_SET_INNER = `
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
      participants {
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
    streamName
    streamSource
  }
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
    displayName: participant.gamerTag,
    pronouns: participant.player.user?.genderPronoun || '',
    prefix: participant.prefix || '',
  };
}
function gqlSetToSet(set: any, updatedAtMs: number): Set {
  const slot1 = set.slots[0];
  const slot2 = set.slots[1];
  const entrant1Participants: Participant[] = slot1.entrant.participants.map(
    gqlParticipantToParticipant,
  );
  const entrant2Participants: Participant[] = slot2.entrant.participants.map(
    gqlParticipantToParticipant,
  );
  return {
    id: set.id,
    state: set.state,
    round:
      set.fullRoundText === 'Grand Final Reset' ? set.round + 1 : set.round,
    fullRoundText: set.fullRoundText,
    winnerId: set.winnerId,
    entrant1Id: slot1.entrant.id,
    entrant1Participants,
    entrant1Score: slot1.standing
      ? slot1.standing.stats.score.displayValue
      : null,
    entrant2Id: slot2.entrant.id,
    entrant2Participants,
    entrant2Score: slot2.standing
      ? slot2.standing.stats.score.displayValue
      : null,
    gameScores: Array.isArray(set.games)
      ? set.games.map((game: any) => ({
          entrant1Score: game.entrant1Score ?? 0,
          entrant2Score: game.entrant2Score ?? 0,
        }))
      : [],
    stream:
      set.stream && set.stream.streamSource && set.stream.streamName
        ? {
            domain: set.stream.streamSource.toLowerCase(),
            path: set.stream.streamName,
          }
        : null,
    ordinal: setIdToOrdinal.get(set.id) ?? null,
    wasReported: reportedSetIds.has(set.id),
    updatedAtMs,
  };
}

const MARK_SET_IN_PROGRESS_MUTATION = `
  mutation MarkSetInProgress($setId: ID!) {
    markSetInProgress(setId: $setId) {${GQL_SET_INNER}}
  }
`;
export async function startSet(key: string, setId: number | string) {
  const updatedAtMs = Date.now();
  try {
    const data = await fetchGql(key, MARK_SET_IN_PROGRESS_MUTATION, { setId });
    const updatedSet = gqlSetToSet(data.markSetInProgress, updatedAtMs);
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
export async function reportSet(key: string, set: StartggSet) {
  const updatedAtMs = Date.now();
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
    const updatedSet = gqlSetToSet(bracketSet, updatedAtMs);
    idToSet.set(updatedSet.id, updatedSet);
    return updatedSet;
  });
  const reportedSet = updatedSets.filter(
    (updatedSet) => updatedSet.state === State.COMPLETED,
  )[0];
  reportedSetIds.set(reportedSet.id, true);
  setSelectedSetId(reportedSet.id);
  return reportedSet;
}

const UPDATE_BRACKET_SET_MUTATION = `
  mutation UpdateBracketSet($setId: ID!, $winnerId: ID, $isDQ: Boolean, $gameData: [BracketSetGameDataInput]) {
    updateBracketSet(setId: $setId, isDQ: $isDQ, winnerId: $winnerId, gameData: $gameData) {${GQL_SET_INNER}}
  }
`;
export async function updateSet(key: string, set: StartggSet) {
  const updatedAtMs = Date.now();
  const data = await fetchGql(key, UPDATE_BRACKET_SET_MUTATION, set);
  const updatedSet = gqlSetToSet(data.updateBracketSet, updatedAtMs);
  reportedSetIds.set(updatedSet.id, true);
  idToSet.set(updatedSet.id, updatedSet);
  setSelectedSetId(updatedSet.id);
  return updatedSet;
}
