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
} from '../common/types';

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

export async function getTournament(
  slug: string,
): Promise<{ name: string; events: Event[] }> {
  const response = await wrappedFetch(
    `https://api.smash.gg/tournament/${slug}?expand%5B%5D=event`,
  );
  const json = await response.json();
  return {
    name: json.entities.tournament.name,
    events: json.entities.event
      .filter((event: any) => {
        const isMelee = event.videogameId === 1;
        const isSinglesOrDoubles =
          event.teamRosterSize === null ||
          (event.teamRosterSize.minPlayers === 2 &&
            event.teamRosterSize.maxPlayers === 2);
        return isMelee && isSinglesOrDoubles;
      })
      .map(
        (event: any): Event => ({
          id: event.id,
          name: event.name,
          slug: event.slug,
          isDoubles:
            event.teamRosterSize &&
            event.teamRosterSize.minPlayers === 2 &&
            event.teamRosterSize.maxPlayers === 2,
          isOnline: event.isOnline,
          state: event.state,
          phases: [],
        }),
      ),
  };
}

export async function getEvent(id: number): Promise<Phase[]> {
  const response = await wrappedFetch(
    `https://api.smash.gg/event/${id}?expand[]=phase`,
  );
  const json = await response.json();
  return json.entities.phase.map(
    (phase: any): Phase => ({
      id: phase.id,
      name: phase.name,
      phaseGroups: [],
      state: phase.state,
    }),
  );
}

export async function getPhase(id: number): Promise<PhaseGroup[]> {
  const response = await wrappedFetch(
    `https://api.smash.gg/phase/${id}?expand[]=groups`,
  );
  const json = await response.json();
  const { bracketType } = json.entities.phase;
  return json.entities.groups
    .map(
      (group: any): PhaseGroup => ({
        id: group.id,
        bracketType,
        entrants: [],
        name: group.displayIdentifier,
        sets: {
          pendingSets: [],
          completedSets: [],
        },
        state: group.state,
      }),
    )
    .sort((phaseGroupA: PhaseGroup, phaseGroupB: PhaseGroup) =>
      phaseGroupA.name.localeCompare(phaseGroupB.name),
    );
}

const API_SET_INNER = `
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
const reportedSetIds = new Map<number, boolean>();
type ApiParticipant = {
  gamerTag: string;
  prefix: string | null;
  player: {
    user: {
      genderPronoun: string | null;
    } | null;
  };
};
function apiParticipantToParticipant(participant: ApiParticipant): Participant {
  return {
    displayName: participant.gamerTag,
    pronouns: participant.player.user?.genderPronoun || '',
    prefix: participant.prefix || '',
  };
}
function apiSetToSet(set: any): Set {
  const slot1 = set.slots[0];
  const slot2 = set.slots[1];
  const entrant1Participants: Participant[] = slot1.entrant.participants.map(
    apiParticipantToParticipant,
  );
  const entrant2Participants: Participant[] = slot2.entrant.participants.map(
    apiParticipantToParticipant,
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
    ordinal: null,
    wasReported: reportedSetIds.has(set.id),
  };
}

const DOUBLES_PAGE_SIZE = 32;
const SINGLES_PAGE_SIZE = 40;
const PHASE_GROUP_QUERY = `
  query PhaseGroupQuery($id: ID!, $page: Int, $pageSize: Int) {
    phaseGroup(id: $id) {
      sets(page: $page, perPage: $pageSize, sortType: CALL_ORDER) {
        pageInfo {
          totalPages
        }
        nodes {${API_SET_INNER}}
      }
    }
  }
`;

// 1838376 genesis-9-1
// 1997685 test-tournament-sorry
// 2181889 BattleGateway-42
// 2139098 the-off-season-2-2 1-000-melee-doubles
// state {1: not started, 2: started, 3: completed}
// sort: completed reverse chronological, then call order
export async function getPhaseGroup(
  key: string,
  id: number,
  isDoubles: boolean,
  updatedSets: Map<number, Set> = new Map(),
): Promise<Sets> {
  let page = 1;
  let nextData;
  const sets: Set[] = [];
  do {
    // eslint-disable-next-line no-await-in-loop
    nextData = await fetchGql(key, PHASE_GROUP_QUERY, {
      id,
      page,
      pageSize: isDoubles ? DOUBLES_PAGE_SIZE : SINGLES_PAGE_SIZE,
    });
    const newSets: Set[] = nextData.phaseGroup.sets.nodes
      .filter(
        (set: any) =>
          (set.slots[0].entrant && set.slots[1].entrant) ||
          updatedSets.has(set.id),
      )
      .map((set: any) => updatedSets.get(set.id) || apiSetToSet(set));
    sets.push(...newSets);

    page += 1;
  } while (page <= nextData.phaseGroup.sets.pageInfo.totalPages);

  const pendingSets: Set[] = [];
  const completedSets: Set[] = [];
  sets.forEach((set) => {
    if (set.state === 3) {
      completedSets.push(set);
    } else {
      pendingSets.push(set);
    }
  });
  return { pendingSets, completedSets };
}

const MARK_SET_IN_PROGRESS_MUTATION = `
  mutation MarkSetInProgress($setId: ID!) {
    markSetInProgress(setId: $setId) {${API_SET_INNER}}
  }
`;
export async function startSet(key: string, setId: number) {
  const data = await fetchGql(key, MARK_SET_IN_PROGRESS_MUTATION, { setId });
  return apiSetToSet(data.markSetInProgress);
}

const REPORT_BRACKET_SET_MUTATION = `
  mutation ReportBracketSet($setId: ID!, $winnerId: ID, $isDQ: Boolean, $gameData: [BracketSetGameDataInput]) {
    reportBracketSet(setId: $setId, isDQ: $isDQ, winnerId: $winnerId, gameData: $gameData) {${API_SET_INNER}}
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
    .map(apiSetToSet);
}

const UPDATE_BRACKET_SET_MUTATION = `
  mutation UpdateBracketSet($setId: ID!, $winnerId: ID, $isDQ: Boolean, $gameData: [BracketSetGameDataInput]) {
    updateBracketSet(setId: $setId, isDQ: $isDQ, winnerId: $winnerId, gameData: $gameData) {${API_SET_INNER}}
  }
`;
export async function updateSet(key: string, set: StartggSet): Promise<Set> {
  const data = await fetchGql(key, UPDATE_BRACKET_SET_MUTATION, set);
  reportedSetIds.set(set.setId, true);
  return apiSetToSet(data.updateBracketSet);
}

const PHASE_GROUP_ENTRANTS_QUERY = `
  query PhaseGroupQuery($id: ID!, $page: Int) {
    phaseGroup(id: $id) {
      standings(query: {page: $page, perPage: 128}) {
        pageInfo {
          totalPages
        }
        nodes {
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
        }
      }
    }
  }
`;

// 2549545 test-tournament-sorry
// 2139098 the-off-season-2-2 1-000-melee-doubles
export async function getPhaseGroupEntrants(
  key: string,
  id: number,
): Promise<Entrant[]> {
  let page = 1;
  let nextData;
  const entrants: Entrant[] = [];
  do {
    // eslint-disable-next-line no-await-in-loop
    nextData = await fetchGql(key, PHASE_GROUP_ENTRANTS_QUERY, {
      id,
      page,
    });
    const newEntrants: Entrant[] = nextData.phaseGroup.standings.nodes.map(
      (standing: any) => ({
        id: standing.entrant.id,
        participants: standing.entrant.participants.map((participant: any) => ({
          displayName: participant.gamerTag,
          prefix: participant.prefix,
          pronouns: participant.player.user?.genderPronoun ?? '',
        })),
      }),
    );
    entrants.push(...newEntrants);

    page += 1;
  } while (page <= nextData.phaseGroup.standings.pageInfo.totalPages);
  return entrants;
}

async function startPhaseGroupsInner(
  key: string,
  phaseGroupAndSetIds: { phaseGroupId: number; setId: string }[],
  idToPhaseGroup: Map<number, PhaseGroup>,
) {
  if (phaseGroupAndSetIds.length === 0) {
    throw new Error('No startable pools found.');
  }

  const inner = phaseGroupAndSetIds
    .map(
      (phaseGroupAndSetId) => `
  ${phaseGroupAndSetId.setId}: reportBracketSet(setId: "${phaseGroupAndSetId.setId}") {${API_SET_INNER}}`,
    )
    .join('');
  const query = `mutation StartPhaseGroups {${inner}\n}`;
  const mutateData = await fetchGql(key, query, {});
  phaseGroupAndSetIds.forEach((phaseGroupAndSetId) => {
    const newSets = mutateData[phaseGroupAndSetId.setId];
    if (Array.isArray(newSets)) {
      const pendingSets = newSets
        .filter((set: any) => set.slots[0].entrant && set.slots[1].entrant)
        .map(apiSetToSet);
      idToPhaseGroup.get(phaseGroupAndSetId.phaseGroupId)!.sets = {
        completedSets: [],
        pendingSets,
      };
    }
  });
}

const EVENT_PHASE_GROUP_REPRESENTATIVE_SET_IDS_QUERY = `
  query EventPhaseGroupsQuery($eventId: ID) {
    event(id: $eventId) {
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
  const retPhases: Phase[] = [];
  const idToPhaseGroup = new Map<number, PhaseGroup>();
  const phaseGroupAndSetIds: { phaseGroupId: number; setId: string }[] = [];
  phases.forEach((phase) => {
    const phaseGroups: PhaseGroup[] = [];
    const phaseGroupNodes = phase.phaseGroups.nodes;
    if (Array.isArray(phaseGroupNodes)) {
      phaseGroupNodes.forEach((phaseGroup) => {
        const newPhaseGroup: PhaseGroup = {
          id: phaseGroup.id,
          bracketType: phaseGroup.bracketType,
          name: phaseGroup.displayIdentifier,
          entrants: [],
          sets: {
            completedSets: [],
            pendingSets: [],
          },
          state: 2,
        };
        phaseGroups.push(newPhaseGroup);
        idToPhaseGroup.set(phaseGroup.id, newPhaseGroup);
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
    retPhases.push({
      id: phase.id,
      name: phase.name,
      phaseGroups,
      state: 2,
    });
  });
  await startPhaseGroupsInner(key, phaseGroupAndSetIds, idToPhaseGroup);
  return retPhases;
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
export async function startPhase(key: string, phaseId: number) {
  const data = await fetchGql(
    key,
    PHASE_PHASE_GROUP_REPRESENTATIVE_SET_IDS_QUERY,
    { phaseId },
  );
  const phaseGroupNodes = data.phase.phaseGroups.nodes;
  if (!Array.isArray(phaseGroupNodes) || phaseGroupNodes.length === 0) {
    throw new Error('Maybe try again or start pools individually?');
  }

  const retPhaseGroups: PhaseGroup[] = [];
  const idToPhaseGroup = new Map<number, PhaseGroup>();
  const phaseGroupAndSetIds: { phaseGroupId: number; setId: string }[] = [];
  phaseGroupNodes.forEach((phaseGroup) => {
    const newPhaseGroup: PhaseGroup = {
      id: phaseGroup.id,
      bracketType: phaseGroup.bracketType,
      name: phaseGroup.displayIdentifier,
      entrants: [],
      sets: {
        completedSets: [],
        pendingSets: [],
      },
      state: 2,
    };
    retPhaseGroups.push(newPhaseGroup);
    idToPhaseGroup.set(phaseGroup.id, newPhaseGroup);
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
  await startPhaseGroupsInner(key, phaseGroupAndSetIds, idToPhaseGroup);
  return retPhaseGroups;
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
export async function startPhaseGroup(key: string, phaseGroupId: number) {
  const data = await fetchGql(key, PHASE_GROUP_REPRESENTATIVE_SET_ID_QUERY, {
    phaseGroupId,
  });
  const { phaseGroup } = data;
  const { nodes } = phaseGroup.sets;
  if (!Array.isArray(nodes) || nodes.length === 0) {
    throw new Error('No startable sets found.');
  }

  const idToPhaseGroup = new Map<number, PhaseGroup>([
    [
      phaseGroup.id,
      {
        id: phaseGroup.id,
        bracketType: phaseGroup.bracketType,
        name: phaseGroup.displayIdentifier,
        entrants: [],
        sets: {
          completedSets: [],
          pendingSets: [],
        },
        state: 2,
      },
    ],
  ]);
  const phaseGroupAndSetIds = [
    {
      phaseGroupId: phaseGroup.id,
      setId: nodes[0].id,
    },
  ];
  await startPhaseGroupsInner(key, phaseGroupAndSetIds, idToPhaseGroup);
  return idToPhaseGroup.get(phaseGroup.id)!.sets;
}
