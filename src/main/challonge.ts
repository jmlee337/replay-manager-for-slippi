import {
  AdminedTournament,
  ChallongeMatchItem,
  ChallongeTournament,
  Entrant,
  Set,
  State,
  Stream,
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

function getStreamFromMatch(
  match: any,
  stationIdToStream: Map<string, Stream>,
) {
  const stationUrl = match.relationships.station?.links.related;
  if (stationUrl) {
    const url = new URL(stationUrl);
    const pathnameParts = url.pathname.split('/');
    const stationId = pathnameParts[pathnameParts.length - 1].split('.')[0];
    if (stationIdToStream.has(stationId)) {
      return stationIdToStream.get(stationId)!;
    }
  }
  return null;
}

const participantIdToName = new Map<number, string>();
const toSet = (
  match: any,
  idToFullRoundText: Map<number, string>,
  stationIdToStream: Map<string, Stream>,
): Set => {
  const participant1 = match.attributes.points_by_participant[0];
  const participant2 = match.attributes.points_by_participant[1];
  let state = State.PENDING;
  if (match.attributes.state === 'complete') {
    state = State.COMPLETED;
  } else if (match.attributes.timestamps.underway_at) {
    state = State.STARTED;
  }
  const { round } = match.attributes;
  const fullRoundText = idToFullRoundText.has(match.id)
    ? idToFullRoundText.get(match.id)!
    : `${round > 0 ? 'Winners Round' : 'Losers Round'} ${Math.abs(round)}`;

  return {
    id: match.id,
    state,
    round,
    fullRoundText,
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
    stream: getStreamFromMatch(match, stationIdToStream),
    ordinal: match.attributes.suggested_play_order,
    wasReported: false,
  };
};

const slugToFinalsMap = new Map<string, Map<number, string>>();
const slugToStationsMap = new Map<string, Map<string, Stream>>();
export async function getChallongeTournament(
  key: string,
  slug: string,
  updatedSet?: Set,
): Promise<ChallongeTournament> {
  const tournamentJson = await get(
    `https://api.challonge.com/v2.1/tournaments/${slug}.json`,
    key,
  );
  const { name, tournament_type: tournamentType } =
    tournamentJson.data.attributes;

  let participantsPage = 0;
  let participantsCount = 0;
  let participantsSeen = 0;
  const entrants: Entrant[] = [];
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
        entrants.push({
          id: participant.id,
          participants: [
            {
              displayName: participant.attributes.name,
              prefix: '',
              pronouns: '',
            },
          ],
        });
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
    const included = json.included as any[];
    const stationIdToStream = new Map<string, Stream>();
    included
      .filter((station) => station.type === 'station')
      .forEach((station) => {
        const url = new URL(station.attributes.stream_url.toLowerCase());
        const hostnameParts = url.hostname.split('.');
        const domain =
          hostnameParts.length > 1
            ? hostnameParts[hostnameParts.length - 2]
            : hostnameParts[0];
        let path = url.pathname.slice(1);
        if (path[path.length - 1] === '/') {
          path = path.slice(0, -1);
        }
        stationIdToStream.set(station.id, { domain, path });
      });
    slugToStationsMap.set(slug, stationIdToStream);
    const data = json.data as any[];
    const idToFullRoundText = new Map<number, string>();
    if (tournamentType === 'double elimination') {
      const gfrSet = data[data.length - 1];
      const gfSet = data[data.length - 2];
      if (
        gfSet.attributes.round === gfrSet.attributes.round &&
        Number.isInteger(gfrSet.attributes.round)
      ) {
        idToFullRoundText.set(gfSet.id, 'Grand Final');
        idToFullRoundText.set(gfrSet.id, 'Grand Final Reset');
        slugToFinalsMap.set(slug, idToFullRoundText);
        gfrSet.attributes.round += 1;
      }
    }
    data
      .filter(
        (match: any) =>
          match.attributes.state === 'open' ||
          match.attributes.state === 'complete',
      )
      .map((match) => {
        if (updatedSet && match.id === updatedSet.id) {
          const mergedSet: Set = { ...updatedSet };
          mergedSet.stream = getStreamFromMatch(match, stationIdToStream);
          return mergedSet;
        }
        return toSet(match, idToFullRoundText, stationIdToStream);
      })
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
    name,
    entrants,
    sets: {
      pendingSets: pendingSets.sort((a, b) => a.ordinal! - b.ordinal!),
      completedSets: completedSets.sort((a, b) => b.ordinal! - a.ordinal!),
    },
    slug,
    tournamentType,
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
    stream: null,
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
  return toSet(
    (await put(url, data, key)).data,
    slugToFinalsMap.get(tournamentSlug) || new Map<number, string>(),
    slugToStationsMap.get(tournamentSlug) || new Map<string, Stream>(),
  );
}
