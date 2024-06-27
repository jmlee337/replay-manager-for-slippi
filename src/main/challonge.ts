import { Set, Sets, State } from '../common/types';

async function get(url: string, key: string) {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: key,
      'Authorization-Type': 'v1',
      'Content-Type': 'application/vnd.api+json',
    },
  });
  if (!response.ok) {
    const keyErr =
      response.status === 401
        ? ' ***Challonge API key invalid or expired!***'
        : '';
    throw new Error(`${response.status} - ${response.statusText}.${keyErr}`);
  }
  return response.json();
}

export default async function getChallongeTournament(
  slug: string,
  key: string,
): Promise<Sets> {
  let participantsPage = 0;
  let participantsCount = 0;
  let participantsSeen = 0;
  const participantIdToName = new Map<number, string>();
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
      .map((match: any) => {
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
              displayName: participantIdToName.get(
                participant1.participant_id,
              )!,
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
              displayName: participantIdToName.get(
                participant2.participant_id,
              )!,
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
        };
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
    pendingSets: pendingSets.sort((a, b) => a.ordinal! - b.ordinal!),
    completedSets: completedSets.sort((a, b) => b.ordinal! - a.ordinal!),
  };
}
