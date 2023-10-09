import { Event, Phase, PhaseGroup, Set, Sets } from '../common/types';

export async function getTournament(slug: string): Promise<Event[]> {
  const response = await fetch(
    `https://api.smash.gg/tournament/${slug}?expand%5B%5D=event`,
  );
  const json = await response.json();
  return json.entities.event
    .filter((event: any) => {
      const isMelee = event.videogameId === 1;
      const isSinglesOrDoulbes =
        event.teamRosterSize === null ||
        (event.teamRosterSize.minPlayers === 2 &&
          event.teamRosterSize.maxPlayers === 2);
      return isMelee && isSinglesOrDoulbes;
    })
    .map(
      (event: any) => ({ id: event.id, name: event.name, phases: [] }) as Event,
    );
}

export async function getEvent(id: number): Promise<Phase[]> {
  const response = await fetch(
    `https://api.smash.gg/event/${id}?expand[]=phase`,
  );
  const json = await response.json();
  return json.entities.phase.map(
    (phase: any) =>
      ({
        id: phase.id,
        name: phase.name,
        phaseGroups: [],
      }) as Phase,
  );
}

export async function getPhase(id: number): Promise<PhaseGroup[]> {
  const response = await fetch(
    `https://api.smash.gg/phase/${id}?expand[]=groups`,
  );
  const json = await response.json();
  return json.entities.groups.map(
    (group: any) =>
      ({
        id: group.id,
        name: group.displayIdentifier,
        sets: {
          pendingSets: [],
          completedSets: [],
        },
      }) as PhaseGroup,
  );
}

async function fetchGql(key: string, query: string, variables: any) {
  const response = await fetch('https://api.start.gg/gql/alpha', {
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

const PHASE_GROUP_QUERY = `
  query PhaseGroupQuery($id:ID!, $page: Int) {
    phaseGroup(id: $id) {
      sets(page: $page, perPage: 52, sortType: CALL_ORDER, filters: {hideEmpty: true}) {
        pageInfo {
          totalPages
        }
        nodes {
          id
          slots {
            entrant {
              id
              participants {
                gamerTag
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
          fullRoundText
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
export async function getPhaseGroup(key: string, id: number): Promise<Sets> {
  let page = 1;
  let nextData;
  const sets: Set[] = [];
  do {
    // eslint-disable-next-line no-await-in-loop
    nextData = await fetchGql(key, PHASE_GROUP_QUERY, { id, page });
    const newSets: Set[] = nextData.phaseGroup.sets.nodes
      .filter((set: any) => set.slots[0].entrant && set.slots[1].entrant)
      .map((set: any) => {
        const slot1 = set.slots[0];
        const slot2 = set.slots[1];
        const entrant1Names = slot1.entrant.participants.map(
          (participant: { gamerTag: string }) => participant.gamerTag,
        );
        const entrant2Names = slot2.entrant.participants.map(
          (participant: { gamerTag: string }) => participant.gamerTag,
        );
        return {
          id: set.id,
          state: set.state,
          fullRoundText: set.fullRoundText,
          winnerId: set.winnerId,
          entrant1Id: slot1.entrant.id,
          entrant1Names,
          entrant1Score: slot1.standing.stats.score.displayValue,
          entrant2Id: slot2.entrant.id,
          entrant2Names,
          entrant2Score: slot2.standing.stats.score.displayValue,
        } as Set;
      });
    sets.push(...newSets);

    page += 1;
  } while (page <= nextData.phaseGroup.sets.pageInfo.totalPages);

  const partIndex = sets.findIndex(
    (set: any) => set.state === 1 || set.state === 2,
  );
  if (partIndex === -1) {
    return { pendingSets: [], completedSets: sets };
  }
  return {
    pendingSets: sets.slice(partIndex),
    completedSets: sets.slice(0, partIndex),
  };
}
