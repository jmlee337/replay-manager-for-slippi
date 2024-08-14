import {
  AdminedTournament,
  Entrant,
  Event,
  Participant,
  Phase,
  PhaseGroup,
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
const idToSet = new Map<number, Set>();
let selectedSetId = 0;
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

export function setSelectedSetId(id: number) {
  selectedSetId = id;
}

export function getSelectedSetChain() {
  return {
    event: idToEvent.get(selectedEventId),
    phase: idToPhase.get(selectedPhaseId),
    phaseGroup: idToPhaseGroup.get(selectedPhaseGroupId),
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
  const response = await fetch(input, init);
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
    const keyErr =
      response.status === 400
        ? ' ***start.gg API key invalid or expired!***'
        : '';
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
const reportedSetIds = new Map<number, boolean>();
const setIdToOrdinal = new Map<number, number | null>();

// 1838376 genesis-9-1
// 2254448 test-tournament-sorry
// 2181889 BattleGateway-42
// 2139098 the-off-season-2-2 1-000-melee-doubles
// state {1: not started, 2: started, 3: completed}
// sort: completed reverse chronological, then call order
export async function getPhaseGroup(
  key: string,
  id: number,
  updatedSets?: Map<number, Set>,
): Promise<PhaseGroup> {
  const response = await wrappedFetch(
    `https://api.smash.gg/phase_group/${id}?expand[]=sets&expand[]=seeds`,
  );
  const json = await response.json();
  const phaseGroup = json.entities.groups;
  const {
    groupTypeId: bracketType,
    displayIdentifier: name,
    state,
  } = phaseGroup;

  const { seeds } = json.entities;
  const entrants: Entrant[] = [];
  if (!Array.isArray(seeds)) {
    throw new Error(`phaseGroup: ${id} doesn't have seeds array.`);
  }
  if (seeds.length === 0) {
    return {
      id,
      bracketType,
      entrants,
      name,
      state,
      sets: { completedSets: [], pendingSets: [] },
    };
  }

  const entrantIdToParticipants = new Map<number, Participant[]>();
  const participantsToUpdate = new Map<number, Participant>();
  const missingPlayerParticipants: {
    participantId: number;
    playerId: number;
  }[] = [];
  seeds.forEach((seed) => {
    const { entrantId } = seed;
    if (!Number.isInteger(entrantId)) {
      return;
    }

    const participants: Participant[] = [];
    Array.from(Object.values(seed.mutations.participants)).forEach(
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
    const setsToUpdate = new Map<number, Set>();
    const missingStreamSets: { setId: number; streamId: number }[] = [];
    sets.forEach((set) => {
      if (set.unreachable) {
        return;
      }
      let newSet: Set | undefined;
      if (updatedSets && updatedSets.has(set.id)) {
        newSet = updatedSets.get(set.id)!;
      } else {
        const { id: setId, entrant1Id, entrant2Id, streamId } = set;
        if (
          !Number.isInteger(setId) ||
          !Number.isInteger(entrant1Id) ||
          !Number.isInteger(entrant2Id)
        ) {
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
          entrant1Id: set.entrant1Id,
          entrant1Participants,
          entrant1Score: set.entrant1Score,
          entrant2Id: set.entrant2Id,
          entrant2Participants,
          entrant2Score: set.entrant2Score,
          stream,
          ordinal: set.callOrder,
          wasReported: reportedSetIds.has(setId),
        };
        setIdToOrdinal.set(setId, newSet.ordinal);
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
      idToSet.set(newSet.id, newSet);
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
  pendingSets.sort((a, b) => (a.ordinal || a.round) - (b.ordinal || b.round));
  completedSets.sort((a, b) => (b.ordinal || b.round) - (a.ordinal || a.round));

  idToPhaseGroup.set(id, {
    id,
    bracketType,
    entrants: [],
    name,
    state,
    sets: { completedSets: [], pendingSets: [] },
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
  };
}

export async function getPhase(key: string, id: number, recursive: boolean) {
  const response = await wrappedFetch(
    `https://api.smash.gg/phase/${id}?expand[]=groups`,
  );
  const json = await response.json();
  const phaseGroups: PhaseGroup[] = [];
  const phaseGroupIds: number[] = [];
  (json.entities.groups as Array<any>)
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
  (json.entities.phase as Array<any>).forEach((phase) => {
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
  const { id, name } = json.entities.tournament;
  const events: Event[] = [];
  const eventIds: number[] = [];
  (json.entities.event as Array<any>)
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

  currentTournament = { name, slug, events: [] };
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
function gqlSetToSet(set: any): Set {
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
    stream:
      set.stream && set.stream.streamSource && set.stream.streamName
        ? {
            domain: set.stream.streamSource.toLowerCase(),
            path: set.stream.streamName,
          }
        : null,
    ordinal: setIdToOrdinal.get(set.id) as number | null,
    wasReported: reportedSetIds.has(set.id),
  };
}

const MARK_SET_IN_PROGRESS_MUTATION = `
  mutation MarkSetInProgress($setId: ID!) {
    markSetInProgress(setId: $setId) {${GQL_SET_INNER}}
  }
`;
export async function startSet(key: string, setId: number) {
  const data = await fetchGql(key, MARK_SET_IN_PROGRESS_MUTATION, { setId });
  return gqlSetToSet(data.markSetInProgress);
}

const REPORT_BRACKET_SET_MUTATION = `
  mutation ReportBracketSet($setId: ID!, $winnerId: ID, $isDQ: Boolean, $gameData: [BracketSetGameDataInput]) {
    reportBracketSet(setId: $setId, isDQ: $isDQ, winnerId: $winnerId, gameData: $gameData) {${GQL_SET_INNER}}
  }
`;
export async function reportSet(key: string, set: StartggSet): Promise<Set[]> {
  const data = await fetchGql(key, REPORT_BRACKET_SET_MUTATION, set);
  reportedSetIds.set(set.setId, true);
  return data.reportBracketSet
    .filter(
      (bracketSet: any) =>
        bracketSet.slots[0].entrant && bracketSet.slots[1].entrant,
    )
    .map(gqlSetToSet);
}

const UPDATE_BRACKET_SET_MUTATION = `
  mutation UpdateBracketSet($setId: ID!, $winnerId: ID, $isDQ: Boolean, $gameData: [BracketSetGameDataInput]) {
    updateBracketSet(setId: $setId, isDQ: $isDQ, winnerId: $winnerId, gameData: $gameData) {${GQL_SET_INNER}}
  }
`;
export async function updateSet(key: string, set: StartggSet): Promise<Set> {
  const data = await fetchGql(key, UPDATE_BRACKET_SET_MUTATION, set);
  reportedSetIds.set(set.setId, true);
  return gqlSetToSet(data.updateBracketSet);
}

async function startPhaseGroupsInner(
  key: string,
  phaseGroupAndSetIds: { phaseGroupId: number; setId: string }[],
) {
  if (phaseGroupAndSetIds.length === 0) {
    throw new Error('No startable pools found.');
  }

  const inner = phaseGroupAndSetIds
    .map(
      (phaseGroupAndSetId) => `
        ${phaseGroupAndSetId.setId}: reportBracketSet(setId: "${phaseGroupAndSetId.setId}") {
          id
        }`,
    )
    .join('');
  const query = `mutation StartPhaseGroups {${inner}\n}`;
  try {
    await fetchGql(key, query, {});
  } catch (e: any) {
    if (
      !(e instanceof Error) ||
      !e.message.startsWith('Your query complexity is too high.')
    ) {
      throw e;
    }
  }
  await Promise.all(
    phaseGroupAndSetIds.map(async ({ phaseGroupId }) =>
      getPhaseGroup(key, phaseGroupId),
    ),
  );
}

const EVENT_PHASE_GROUP_REPRESENTATIVE_SET_IDS_QUERY = `
  query EventPhaseGroupsQuery($eventId: ID) {
    event(id: $eventId) {
      name
      slug
      isOnline
      phases {
        id
        name
        phaseGroups(query: {page: 1, perPage: 500}) {
          nodes {
            id
            bracketType
            displayIdentifier
            sets(page: 1, perPage: 1, filters: {hideEmpty: false, showByes: false}) {
              nodes {
                id
              }
            }
          }
        }
      }
    }
  }
`;
export async function startEvent(key: string, eventId: number) {
  const data = await fetchGql(
    key,
    EVENT_PHASE_GROUP_REPRESENTATIVE_SET_IDS_QUERY,
    { eventId },
  );
  const { phases } = data.event;
  if (!Array.isArray(phases) || phases.length === 0) {
    throw new Error('Maybe try again or start phases individually?');
  }
  const updatedPhases: Phase[] = [];
  const phaseIdAndPhaseGroupIds: {
    phaseId: number;
    phaseGroupIds: number[];
  }[] = [];
  const phaseGroupAndSetIds: { phaseGroupId: number; setId: string }[] = [];
  phases.forEach((phase) => {
    const phaseGroupIds: number[] = [];
    const phaseGroupNodes = phase.phaseGroups.nodes;
    if (Array.isArray(phaseGroupNodes)) {
      phaseGroupNodes.forEach((phaseGroup) => {
        phaseGroupIds.push(phaseGroup.id);
        const setNodes = phaseGroup.sets.nodes;
        if (Array.isArray(setNodes) && setNodes.length > 0) {
          const { id } = setNodes[0];
          if (typeof id === 'string' && id.startsWith('preview')) {
            phaseGroupAndSetIds.push({
              phaseGroupId: phaseGroup.id,
              setId: id,
            });
          }
        }
      });
    }
    updatedPhases.push({
      id: phase.id,
      name: phase.name,
      phaseGroups: [],
      state: State.STARTED,
    });
    phaseIdAndPhaseGroupIds.push({ phaseId: phase.id, phaseGroupIds });
  });
  await startPhaseGroupsInner(key, phaseGroupAndSetIds);

  idToEvent.set(eventId, {
    id: eventId,
    name: data.event.name,
    slug: data.event.slug,
    isOnline: data.event.isOnline,
    state: State.STARTED,
    phases: [],
  });
  const phaseIds: number[] = [];
  updatedPhases.forEach((phase) => {
    phaseIds.push(phase.id);
    idToPhase.set(phase.id, phase);
  });
  phaseIdAndPhaseGroupIds.forEach(({ phaseId, phaseGroupIds }) => {
    phaseIdToPhaseGroupIds.set(phaseId, phaseGroupIds);
  });
  eventIdToPhaseIds.set(eventId, phaseIds);
}

const PHASE_PHASE_GROUP_REPRESENTATIVE_SET_IDS_QUERY = `
  query PhasePhaseGroupsQuery($phaseId: ID) {
    phase(id: $phaseId) {
      id
      name
      phaseGroups(query: {page: 1, perPage: 500}) {
        nodes {
          id
          bracketType
          displayIdentifier
          sets(page: 1, perPage: 1, filters: {hideEmpty: false, showByes: false}) {
            nodes {
              id
            }
          }
        }
      }
    }
  }
`;
export async function startPhase(
  key: string,
  phaseId: number,
  eventId: number,
) {
  const data = await fetchGql(
    key,
    PHASE_PHASE_GROUP_REPRESENTATIVE_SET_IDS_QUERY,
    { phaseId },
  );
  const phaseGroupNodes = data.phase.phaseGroups.nodes;
  if (!Array.isArray(phaseGroupNodes) || phaseGroupNodes.length === 0) {
    throw new Error('Maybe try again or start pools individually?');
  }

  const phaseGroupIds: number[] = [];
  const phaseGroupAndSetIds: { phaseGroupId: number; setId: string }[] = [];
  phaseGroupNodes.forEach((phaseGroup) => {
    phaseGroupIds.push(phaseGroup.id);
    const setNodes = phaseGroup.sets.nodes;
    if (Array.isArray(setNodes) && setNodes.length > 0) {
      const { id } = setNodes[0];
      if (typeof id === 'string' && id.startsWith('preview')) {
        phaseGroupAndSetIds.push({
          phaseGroupId: phaseGroup.id,
          setId: id,
        });
      }
    }
  });
  await startPhaseGroupsInner(key, phaseGroupAndSetIds);

  idToPhase.set(phaseId, {
    id: phaseId,
    name: data.phase.name,
    state: State.STARTED,
    phaseGroups: [],
  });
  phaseIdToPhaseGroupIds.set(phaseId, phaseGroupIds);
  const updateEvent = idToEvent.get(eventId);
  if (updateEvent) {
    updateEvent.state = State.STARTED;
  }
}

const PHASE_GROUP_REPRESENTATIVE_SET_ID_QUERY = `
  query PhaseGroupQuery($phaseGroupId: ID) {
    phaseGroup(id: $phaseGroupId) {
      id
      bracketType
      displayIdentifier
      sets(page: 1, perPage: 1, filters: {hideEmpty: false, showByes: false}) {
        nodes {
          id
        }
      }
    }
  }
`;
export async function startPhaseGroup(
  key: string,
  phaseGroupId: number,
  phaseId: number,
  eventId: number,
) {
  const data = await fetchGql(key, PHASE_GROUP_REPRESENTATIVE_SET_ID_QUERY, {
    phaseGroupId,
  });
  const { phaseGroup } = data;
  const { nodes } = phaseGroup.sets;
  if (
    !Array.isArray(nodes) ||
    nodes.length === 0 ||
    typeof nodes[0].id !== 'string' ||
    !nodes[0].id.startsWith('preview')
  ) {
    throw new Error('This pool cannot be started.');
  }

  const phaseGroupAndSetIds = [
    {
      phaseGroupId: phaseGroup.id,
      setId: nodes[0].id,
    },
  ];
  await startPhaseGroupsInner(key, phaseGroupAndSetIds);
  const updatePhase = idToPhase.get(phaseId);
  if (updatePhase) {
    updatePhase.state = State.STARTED;
  }
  const updateEvent = idToEvent.get(eventId);
  if (updateEvent) {
    updateEvent.state = State.STARTED;
  }
}
