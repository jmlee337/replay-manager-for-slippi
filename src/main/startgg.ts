import {
  AdminedTournament,
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
    }),
  );
}

export async function getPhase(id: number): Promise<PhaseGroup[]> {
  const response = await wrappedFetch(
    `https://api.smash.gg/phase/${id}?expand[]=groups`,
  );
  const json = await response.json();
  return json.entities.groups
    .map(
      (group: any): PhaseGroup => ({
        id: group.id,
        name: group.displayIdentifier,
        sets: {
          pendingSets: [],
          completedSets: [],
        },
      }),
    )
    .sort((phaseGroupA: PhaseGroup, phaseGroupB: PhaseGroup) =>
      phaseGroupA.name.localeCompare(phaseGroupB.name),
    );
}

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
    twitchStream:
      set.stream &&
      set.stream.streamName &&
      set.stream.streamSource === 'TWITCH'
        ? set.stream.streamName
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
        nodes {
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
        }
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
    markSetInProgress(setId: $setId) {
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
    }
  }
`;
export async function startSet(key: string, setId: number) {
  const data = await fetchGql(key, MARK_SET_IN_PROGRESS_MUTATION, { setId });
  return apiSetToSet(data.markSetInProgress);
}

const REPORT_BRACKET_SET_MUTATION = `
  mutation ReportBracketSet($setId: ID!, $winnerId: ID, $isDQ: Boolean, $gameData: [BracketSetGameDataInput]) {
    reportBracketSet(setId: $setId, isDQ: $isDQ, winnerId: $winnerId, gameData: $gameData) {
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
    }
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
    updateBracketSet(setId: $setId, isDQ: $isDQ, winnerId: $winnerId, gameData: $gameData) {
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
    }
  }
`;
export async function updateSet(key: string, set: StartggSet): Promise<Set> {
  const data = await fetchGql(key, UPDATE_BRACKET_SET_MUTATION, set);
  reportedSetIds.set(set.setId, true);
  return apiSetToSet(data.updateBracketSet);
}
