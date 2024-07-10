import {
  AdminedTournament,
  ChallongeMatchItem,
  Set,
  Sets,
  State,
} from '../common/types';

async function wrappedFetch(url: string, init: RequestInit) {
  const response = await fetch(url, init);
  if (!response.ok) {
    const keyErr =
      response.status === 401
        ? ' ***Challonge API key invalid or expired!***'
        : '';
    throw new Error(`${response.status} - ${response.statusText}.${keyErr}`);
  }
  return response.json();
}

async function get(url: string, key: string) {
  return wrappedFetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: key,
      'Authorization-Type': 'v1',
      'Content-Type': 'application/vnd.api+json',
    },
  });
}

async function put(url: string, data: any | null, key: string) {
  const init: RequestInit = {
    method: 'PUT',
    headers: {
      Accept: 'application/json',
      Authorization: key,
      'Authorization-Type': 'v1',
      'Content-Type': 'application/vnd.api+json',
    },
  };
  if (data) {
    init.body = JSON.stringify({ data });
  }
  return wrappedFetch(url, init);
}

export async function getChallongeTournaments(
  key: string,
): Promise<AdminedTournament[]> {
  const json = await get(
    'https://api.challonge.com/v2.1/tournaments.json?page=1&per_page=1000',
    key,
  );
  return json.data.map((tournament: any) => ({
    slug: tournament.attributes.url,
    name: tournament.attributes.name,
  }));
}

export async function getChallongeTournamentName(
  slug: string,
  key: string,
): Promise<string> {
  const json = await get(
    `https://api.challonge.com/v2.1/tournaments/${slug}.json`,
    key,
  );
  return json.data.attributes.name;
}

const participantIdToName = new Map<number, string>();
const toSet = (match: any): Set => {
  const participant1 = match.attributes.points_by_participant[0];
  const participant2 = match.attributes.points_by_participant[1];
  let state = State.PENDING;
  if (match.attributes.state === 'complete') {
    state = State.COMPLETED;
  } else if (match.attributes.timestamps.underway_at) {
    state = State.STARTED;
  }
  const { round } = match.attributes;
  const fullRoundPrefix = round > 0 ? 'Winners Round' : 'Losers Round';
  return {
    id: match.id,
    state,
    round,
    fullRoundText: `${fullRoundPrefix} ${Math.abs(round)}`,
    winnerId: match.attributes.winner_id,
    entrant1Id: participant1.participant_id,
    entrant1Participants: [
      {
        displayName: participantIdToName.get(participant1.participant_id)!,
        prefix: '',
        pronouns: '',
      },
    ],
    entrant1Score:
      match.attributes.state === 'complete'
        ? (participant1.scores[0] as number).toString(10)
        : null,
    entrant2Id: participant2.participant_id,
    entrant2Participants: [
      {
        displayName: participantIdToName.get(participant2.participant_id)!,
        prefix: '',
        pronouns: '',
      },
    ],
    entrant2Score:
      match.attributes.state === 'complete'
        ? (participant2.scores[0] as number).toString(10)
        : null,
    twitchStream: null,
    ordinal: match.attributes.suggested_play_order,
    wasReported: false,
  };
};

export async function getChallongeSets(
  slug: string,
  key: string,
): Promise<Sets> {
  let participantsPage = 0;
  let participantsCount = 0;
  let participantsSeen = 0;
  do {
    participantsPage += 1;
    // eslint-disable-next-line no-await-in-loop
    const json = await get(
      `https://api.challonge.com/v2.1/tournaments/${slug}/participants.json?page=${participantsPage}&per_page=1000`,
      key,
    );
    const data = json.data as any[];
    data
      .filter((participant: any) => participant.type === 'participant')
      .forEach((participant: any) => {
        participantIdToName.set(
          parseInt(participant.id, 10),
          participant.attributes.name,
        );
      });
    participantsCount = json.meta.count;
    participantsSeen += data.length;
  } while (participantsSeen < participantsCount);

  let matchesPage = 0;
  let matchesCount = 0;
  let matchesSeen = 0;
  const pendingSets: Set[] = [];
  const completedSets: Set[] = [];
  do {
    matchesPage += 1;
    // eslint-disable-next-line no-await-in-loop
    const json = await get(
      `https://api.challonge.com/v2.1/tournaments/${slug}/matches.json?page=${matchesPage}&per_page=1000`,
      key,
    );
    const data = json.data as any[];
    data
      .filter(
        (match: any) =>
          match.type === 'match' &&
          (match.attributes.state === 'open' ||
            match.attributes.state === 'complete'),
      )
      .map(toSet)
      .forEach((set) => {
        if (set.state === State.COMPLETED) {
          completedSets.push(set);
        } else {
          pendingSets.push(set);
        }
      });
    matchesCount = json.meta.count;
    matchesSeen += data.length;
  } while (matchesSeen < matchesCount);
  return {
    pendingSets: pendingSets.sort((a, b) => a.ordinal! - b.ordinal!),
    completedSets: completedSets.sort((a, b) => b.ordinal! - a.ordinal!),
  };
}

export async function startChallongeSet(
  tournamentSlug: string,
  matchId: number,
  key: string,
): Promise<Set> {
  const url = `https://api.challonge.com/v1/tournaments/${tournamentSlug}/matches/${matchId}/mark_as_underway.json?api_key=${key}`;
  const data = await wrappedFetch(url, {
    method: 'POST',
  });
  const { match } = data;
  const { round } = match;
  const fullRoundPrefix = round > 0 ? 'Winners Round' : 'Losers Round';
  return {
    id: match.id,
    state: State.STARTED,
    round,
    fullRoundText: `${fullRoundPrefix} ${Math.abs(round)}`,
    winnerId: match.winner_id,
    entrant1Id: match.player1_id,
    entrant1Participants: [
      {
        displayName: participantIdToName.get(match.player1_id)!,
        prefix: '',
        pronouns: '',
      },
    ],
    entrant1Score: null,
    entrant2Id: match.player2_id,
    entrant2Participants: [
      {
        displayName: participantIdToName.get(match.player2_id)!,
        prefix: '',
        pronouns: '',
      },
    ],
    entrant2Score: null,
    twitchStream: null,
    ordinal: match.suggested_play_order,
    wasReported: false,
  };
}

export async function reportChallongeSet(
  tournamentSlug: string,
  matchId: number,
  matchItems: ChallongeMatchItem[],
  key: string,
) {
  const url = `https://api.challonge.com/v2.1/tournaments/${tournamentSlug}/matches/${matchId}.json`;
  const data = {
    type: 'Match',
    attributes: {
      match: matchItems,
      tie: false,
    },
  };
  return toSet((await put(url, data, key)).data);
}
