import {
  TournamentServiceClient,
  GetTournamentRequest,
  GetTournamentsRequest,
  GetTournamentsOptions,
  TournamentsFilter,
  AdminFilter,
  AdminFilterPermission,
  MatchServiceClient,
  StartMatchRequest,
  SetMatchResultRequest,
  MatchResult,
  MatchResultSlotMutation,
  SlugType,
  MatchState,
  BracketServiceClient,
  GetBracketRequest,
  EventServiceClient,
  GetEventRequest,
  PhaseServiceClient,
  GetPhaseRequest,
  Entrant,
  Tournament,
  Match,
  Phase,
  Event,
  Seed,
  BracketType,
} from '@parry-gg/client';
import XMLHttpRequest from 'xhr2';
import {
  ParryggBracket,
  AdminedTournament,
  SelectedPhase,
  Set,
  State,
  Participant,
  Sets,
  SelectedPhaseGroup,
  SelectedEvent,
} from '../common/types';

// XMLHttpRequest polyfill for grpcweb requests
(global as any).XMLHttpRequest = XMLHttpRequest;

const tournaments = new Map<string, Tournament.AsObject>();
const seedMap = new Map<string, Seed.AsObject>();
const tournamentSlugToEventIds = new Map<string, string[]>();
const idToEvent = new Map<string, Event.AsObject>();
const eventIdToPhaseIds = new Map<string, string[]>();
const idToPhase = new Map<string, Phase.AsObject>();
const phaseIdToBracketIds = new Map<string, string[]>();
const idToBracket = new Map<string, ParryggBracket>();
const bracketIdToSets = new Map<string, Sets>();
const setIdToSet = new Map<string, Set>();
const setIdToOrdinal = new Map<string, number>();
let currentTournament: Tournament.AsObject | undefined;
let selectedEventId: string | undefined;
let selectedPhaseId: string | undefined;
let selectedBracketId: string | undefined;
let selectedSetId: string | undefined;

// Initialize parry.gg API clients
const PARRYGG_API_BASE = 'https://grpcweb.parry.gg';
const tournamentClient = new TournamentServiceClient(PARRYGG_API_BASE);
const matchClient = new MatchServiceClient(PARRYGG_API_BASE);
const bracketClient = new BracketServiceClient(PARRYGG_API_BASE);
const eventClient = new EventServiceClient(PARRYGG_API_BASE);
const phaseClient = new PhaseServiceClient(PARRYGG_API_BASE);

function createAuthMetadata(apiKey: string): { [key: string]: string } {
  return {
    'X-API-KEY': apiKey,
  };
}

function getSlug(tournament: Tournament.AsObject) {
  return (
    tournament.slugsList.find(
      (slug) => slug.type === SlugType.SLUG_TYPE_PRIMARY,
    )?.slug || ''
  );
}

function getSetState(set: Match.AsObject): State {
  switch (set.state) {
    case MatchState.MATCH_STATE_COMPLETED:
      return State.COMPLETED;
    case MatchState.MATCH_STATE_IN_PROGRESS:
      return State.STARTED;
    case MatchState.MATCH_STATE_PENDING:
    default:
      return State.PENDING;
  }
}

function getParticipants(entrant?: Entrant.AsObject) {
  if (!entrant) {
    return [{ id: '', displayName: 'TBD', prefix: '', pronouns: '' }];
  }
  return entrant.usersList.map((u) => ({
    id: u.id,
    displayName: u.gamerTag,
    prefix: '',
    pronouns: u.pronouns,
  }));
}

// DAG Graph of a bracket.
// nodes are set ids. Edges connect sets to their winner/loser sets.
// Key: setId, Value: array of destination setIds
type Graph = Map<string, string[]>;

function buildGraph(matches: Match.AsObject[]): Graph {
  const graph: Graph = new Map();
  const matchMap = new Map<string, Match.AsObject>();

  matches.forEach((match) => {
    matchMap.set(match.id, match);
    graph.set(match.id, []);
  });

  matches.forEach((match) => {
    if (match.winnersMatchId && matchMap.has(match.winnersMatchId)) {
      graph.get(match.id)?.push(match.winnersMatchId);
    }
    if (match.losersMatchId && matchMap.has(match.losersMatchId)) {
      graph.get(match.id)?.push(match.losersMatchId);
    }
  });

  return graph;
}

// Kahn's algorithm for topological sorting
function topoSort(graph: Graph) {
  const inDegree = new Map<string, number>();

  Array.from(graph.keys()).forEach((node) => {
    inDegree.set(node, 0);
  });

  Array.from(graph.values()).forEach((neighbors) => {
    neighbors.forEach((neighbor) => {
      inDegree.set(neighbor, (inDegree.get(neighbor) || 0) + 1);
    });
  });

  const queue: string[] = [];
  const sortedNodes: string[] = [];

  Array.from(inDegree.entries()).forEach(([node, degree]) => {
    if (degree === 0) {
      queue.push(node);
    }
  });

  while (queue.length > 0) {
    const currentNode = queue.shift()!;
    sortedNodes.push(currentNode);

    const neighbors = graph.get(currentNode) || [];
    neighbors.forEach((neighbor) => {
      const newDegree = (inDegree.get(neighbor) || 0) - 1;
      inDegree.set(neighbor, newDegree);

      if (newDegree === 0) {
        queue.push(neighbor);
      }
    });
  }

  return sortedNodes;
}

function getOrderedSetIds(bracket: ParryggBracket): string[] {
  if (
    bracket.type === BracketType.BRACKET_TYPE_SINGLE_ELIMINATION ||
    bracket.type === BracketType.BRACKET_TYPE_DOUBLE_ELIMINATION
  ) {
    const graph = buildGraph(bracket.matchesList);
    return topoSort(graph);
  }

  return bracket.matchesList
    .map((match) => match.id) // UUIDv7 which are timestamp ordered
    .sort();
}

function updateSetOrdinalMap(bracket: ParryggBracket): void {
  const sortedMatchIds = getOrderedSetIds(bracket);
  sortedMatchIds.forEach((matchId, i) => {
    setIdToOrdinal.set(matchId, i);
  });
}

export function convertParryggSetToSet(set: Match.AsObject): Set {
  const slots = set.slotsList;
  const slot1 = slots[0];
  const slot2 = slots[1];
  const entrant1 = seedMap.get(slot1.seedId)?.eventEntrant?.entrant;
  const entrant2 = seedMap.get(slot2.seedId)?.eventEntrant?.entrant;

  const entrant1Participants: Participant[] = getParticipants(entrant1);
  const entrant2Participants: Participant[] = getParticipants(entrant2);

  const winnerSlot = slots.find((slot) => slot.placement === 1);
  const winnerId = winnerSlot ? parseInt(winnerSlot.seedId, 10) || null : null;

  return {
    id: set.id,
    state: getSetState(set),
    round: set.round,
    fullRoundText: `Round ${set.round}${
      set.winnersSide ? ' Winners' : ' Losers'
    }`,
    winnerId,
    entrant1Id: entrant1?.id ?? '',
    entrant1Participants,
    entrant1Score:
      set.state === MatchState.MATCH_STATE_COMPLETED ? slot1.score : null,
    entrant2Id: entrant2?.id ?? '',
    entrant2Participants,
    entrant2Score:
      set.state === MatchState.MATCH_STATE_COMPLETED ? slot2.score : null,
    gameScores: [],
    stream: null,
    station: null,
    ordinal: setIdToOrdinal.get(set.id) ?? null,
    wasReported: false,
    updatedAtMs: 0,
    completedAtMs: 0,
  };
}

function updateBracketGlobalState(bracket: ParryggBracket): void {
  idToBracket.set(bracket.id, bracket);

  // Update ordinal map for single/double elimination brackets
  updateSetOrdinalMap(bracket);

  bracket.seedsList.forEach((seed) => {
    seedMap.set(seed.id, seed);
  });

  const filteredSets = bracket.matchesList.filter(
    (set) =>
      set.state === MatchState.MATCH_STATE_READY ||
      set.state === MatchState.MATCH_STATE_IN_PROGRESS ||
      set.state === MatchState.MATCH_STATE_COMPLETED,
  );

  const convertedSets = filteredSets.map(convertParryggSetToSet);
  bracketIdToSets.set(bracket.id, {
    pendingSets: convertedSets.filter((set) => set.state !== State.COMPLETED),
    completedSets: convertedSets.filter((set) => set.state === State.COMPLETED),
  });

  filteredSets.forEach((set) => {
    setIdToSet.set(set.id, convertParryggSetToSet(set));
  });
}

function updatePhaseGlobalState(phase: Phase.AsObject): void {
  idToPhase.set(phase.id, phase);

  phase.bracketsList.forEach((bracket) => {
    updateBracketGlobalState(bracket);
  });
  phaseIdToBracketIds.set(
    phase.id,
    phase.bracketsList.map((b) => b.id),
  );
}

function updateEventGlobalState(event: Event.AsObject): void {
  idToEvent.set(event.id, event);

  event.phasesList.forEach((phase) => {
    updatePhaseGlobalState(phase);
  });
  eventIdToPhaseIds.set(
    event.id,
    event.phasesList.map((p) => p.id),
  );
}

function updateTournamentGlobalState(tournament: Tournament.AsObject): void {
  const tournamentSlug = getSlug(tournament);

  tournaments.set(tournament.id, tournament);

  tournament.eventsList.forEach((event) => {
    updateEventGlobalState(event);
  });
  tournamentSlugToEventIds.set(
    tournamentSlug,
    tournament.eventsList.map((e) => e.id),
  );
}

function createMatchResultFromMatchResultObject(
  result: MatchResult.AsObject,
): MatchResult {
  const matchResult = new MatchResult();
  const slotMutations: MatchResultSlotMutation[] = [];

  result.slotsList.forEach((slotResult, index) => {
    const slotMutation = new MatchResultSlotMutation();
    slotMutation.setSlot(index);
    slotMutation.setScore(slotResult.score ?? 0);
    slotMutation.setState(slotResult.state ?? 0);
    slotMutations.push(slotMutation);
  });

  matchResult.setSlotsList(slotMutations);
  return matchResult;
}

export function getAdminedParryggTournaments() {
  return tournaments;
}

export function getCurrentParryggTournament(): Tournament.AsObject | undefined {
  if (!currentTournament) {
    return undefined;
  }

  const tournament: Tournament.AsObject = { ...currentTournament };
  const events = tournamentSlugToEventIds
    .get(getSlug(tournament))!
    .map((eventId) => {
      const event: Event.AsObject = { ...idToEvent.get(eventId)! };
      event.phasesList = (eventIdToPhaseIds.get(eventId) || []).map(
        (phaseId) => {
          const phase: Phase.AsObject = { ...idToPhase.get(phaseId)! };
          phase.bracketsList = (phaseIdToBracketIds.get(phaseId) || []).map(
            (bracketId) => {
              const bracket: ParryggBracket = {
                ...idToBracket.get(bracketId)!,
              };
              const storedSets = bracketIdToSets.get(bracketId);
              if (storedSets) {
                bracket.sets = storedSets;
              }
              return bracket;
            },
          );
          return phase;
        },
      );
      return event;
    });
  tournament.eventsList = events;
  return tournament;
}

export function getSelectedParryggSetChain(): {
  event?: SelectedEvent;
  phase?: SelectedPhase;
  bracket?: SelectedPhaseGroup;
} {
  const selectedEvent = idToEvent.get(selectedEventId!);
  const selectedPhase = idToPhase.get(selectedPhaseId!);
  const selectedBracket = idToBracket.get(selectedBracketId!);
  let event: SelectedEvent | undefined;
  let phase: SelectedPhase | undefined;
  let bracket: SelectedPhaseGroup | undefined;
  if (currentTournament) {
    if (selectedEvent) {
      event = {
        id: selectedEvent.id,
        name: selectedEvent.name,
        slug: selectedEvent.slug,
        hasSiblings:
          tournamentSlugToEventIds.get(getSlug(currentTournament))!.length > 1,
      };
    }
    if (selectedPhase) {
      phase = {
        id: selectedPhase.id,
        name: selectedPhase.slug,
        hasSiblings: eventIdToPhaseIds.get(selectedEventId!)!.length > 1,
      };
    }
    if (selectedBracket) {
      bracket = {
        id: selectedBracket.id,
        name: selectedBracket.slug,
        hasSiblings: phaseIdToBracketIds.get(selectedPhaseId!)!.length > 1,
        bracketType: selectedBracket.type,
        waveId: null,
        winnersTargetPhaseId: null,
      };
    }
  }
  return {
    event,
    phase,
    bracket,
  };
}

export function getSelectedParryggSet(): Set | undefined {
  return setIdToSet.get(selectedSetId ?? '');
}

export function setSelectedParryggSetId(id: string) {
  selectedSetId = id;
}

export function setSelectedParryggTournament(slug: string) {
  // Find and set the current tournament by slug
  const tournamentArray = Array.from(tournaments.values());
  const foundTournament = tournamentArray.find(
    (tournament) => getSlug(tournament) === slug,
  );
  if (foundTournament) {
    currentTournament = foundTournament;
  }
}

export function setSelectedParryggSetChain(
  eventId: string,
  phaseId: string,
  bracketId: string,
) {
  selectedEventId = eventId;
  selectedPhaseId = phaseId;
  selectedBracketId = bracketId;
}

export async function getParryggEvent(
  apiKey: string,
  eventId: string,
): Promise<void> {
  const request = new GetEventRequest();
  request.setId(eventId);

  const response = await eventClient.getEvent(
    request,
    createAuthMetadata(apiKey),
  );
  const event = response.getEvent();

  if (!event) {
    throw new Error('Event not found');
  }

  const eventObj = event.toObject();
  updateEventGlobalState(eventObj);
}

export async function getParryggPhase(
  apiKey: string,
  phaseId: string,
): Promise<void> {
  const request = new GetPhaseRequest();
  request.setId(phaseId);

  const response = await phaseClient.getPhase(
    request,
    createAuthMetadata(apiKey),
  );
  const phase = response.getPhase();

  if (!phase) {
    throw new Error('Phase not found');
  }
  updatePhaseGlobalState(phase.toObject());
}

export async function getParryggBracket(
  apiKey: string,
  bracketId: string,
): Promise<void> {
  const request = new GetBracketRequest();
  request.setId(bracketId);

  const response = await bracketClient.getBracket(
    request,
    createAuthMetadata(apiKey),
  );
  const bracket = response.getBracket();

  if (!bracket) {
    throw new Error('Bracket not found');
  }

  updateBracketGlobalState(bracket.toObject());
}

export async function getParryggTournaments(
  apiKey: string,
): Promise<AdminedTournament[]> {
  const request = new GetTournamentsRequest();
  const tournamentsFilter = new TournamentsFilter();
  const adminFilter = new AdminFilter();
  const options = new GetTournamentsOptions();

  options.setReturnPermissions(true);
  adminFilter.setPermission(AdminFilterPermission.ADMIN_FILTER_PERMISSION_ANY);
  tournamentsFilter.setAdminFilter(adminFilter);
  request.setFilter(tournamentsFilter);
  request.setOptions(options);

  const response = await tournamentClient.getTournaments(
    request,
    createAuthMetadata(apiKey),
  );

  return response
    .getTournamentsList()
    .sort((a, b) => {
      return b.getStartDate().getSeconds() - a.getStartDate().getSeconds();
    })
    .map((tournament) => ({
      id: tournament.getId(),
      slug: getSlug(tournament.toObject()),
      name: tournament.getName(),
    }));
}

export async function getParryggTournament(
  apiKey: string,
  tournamentSlug: string,
  recursive: boolean = false,
): Promise<void> {
  const request = new GetTournamentRequest();
  request.setTournamentSlug(tournamentSlug);

  const response = await tournamentClient.getTournament(
    request,
    createAuthMetadata(apiKey),
  );
  const tournament = response.getTournament();

  if (!tournament) {
    throw new Error('Tournament not found');
  }

  seedMap.clear();

  currentTournament = tournament.toObject();
  updateTournamentGlobalState(currentTournament);

  const events = tournament.getEventsList();
  const phases = events.flatMap((event) => event.getPhasesList());
  const brackets = phases.flatMap((phase) => phase.getBracketsList());

  await Promise.all(
    brackets.map(async (bracket) => {
      const shouldLoadBracket = bracket.getMatchesList().length > 0;
      if (recursive || shouldLoadBracket) {
        await getParryggBracket(apiKey, bracket.getId());
      }
    }),
  );
}

export async function startParryggSet(
  apiKey: string,
  setId: string,
): Promise<void> {
  const request = new StartMatchRequest();
  request.setId(setId);

  await matchClient.startMatch(request, createAuthMetadata(apiKey));
}

export async function reportParryggSet(
  apiKey: string,
  setId: string,
  result: MatchResult.AsObject,
): Promise<Set | undefined> {
  const matchResult = createMatchResultFromMatchResultObject(result);

  const request = new SetMatchResultRequest();
  request.setId(setId);
  request.setResult(matchResult);

  await matchClient.setMatchResult(request, createAuthMetadata(apiKey));
  return getSelectedParryggSet();
}
