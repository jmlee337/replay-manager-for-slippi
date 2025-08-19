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
} from '@parry-gg/client';
import XMLHttpRequest from 'xhr2';
import {
  ParryggTournament,
  ParryggEvent,
  ParryggPhase,
  ParryggBracket,
  ParryggSet,
  ParryggSetResult,
  AdminedTournament,
  ParryggSetChain,
  SelectedParryggEvent,
  SelectedParryggPhase,
  SelectedParryggBracket,
  Set,
  State,
  ParryggSeed,
  Participant,
  Sets,
} from '../common/types';

// XMLHttpRequest polyfill for grpcweb requests
(global as any).XMLHttpRequest = XMLHttpRequest;

const tournaments = new Map<string, ParryggTournament>();
const seedMap = new Map<string, ParryggSeed>();
const tournamentSlugToEventIds = new Map<string, string[]>();
const idToEvent = new Map<string, ParryggEvent>();
const eventIdToPhaseIds = new Map<string, string[]>();
const idToPhase = new Map<string, ParryggPhase>();
const phaseIdToBracketIds = new Map<string, string[]>();
const idToBracket = new Map<string, ParryggBracket>();
const bracketIdToSets = new Map<string, Sets>();
const setIdToSet = new Map<string, Set>();
let currentTournament: ParryggTournament | undefined;
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

function getSlug(tournament: ParryggTournament) {
  return (
    tournament.slugsList.find(
      (slug) => slug.type === SlugType.SLUG_TYPE_PRIMARY,
    )?.slug || ''
  );
}

function getSetState(set: ParryggSet): State {
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

export function convertParryggSetToSet(set: ParryggSet): Set {
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
    ordinal: null,
    wasReported: false,
    updatedAtMs: 0,
    completedAtMs: 0,
  };
}

function updateBracketGlobalState(bracket: ParryggBracket): void {
  idToBracket.set(bracket.id, bracket);

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

function updatePhaseGlobalState(phase: ParryggPhase): void {
  idToPhase.set(phase.id, phase);

  phase.bracketsList.forEach((bracket) => {
    updateBracketGlobalState(bracket);
  });
  phaseIdToBracketIds.set(
    phase.id,
    phase.bracketsList.map((b) => b.id),
  );
}

function updateEventGlobalState(event: ParryggEvent): void {
  idToEvent.set(event.id, event);

  event.phasesList.forEach((phase) => {
    updatePhaseGlobalState(phase);
  });
  eventIdToPhaseIds.set(
    event.id,
    event.phasesList.map((p) => p.id),
  );
}

function updateTournamentGlobalState(tournament: ParryggTournament): void {
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

function createMatchResultFromParryggSetResult(
  result: ParryggSetResult,
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

export function getCurrentParryggTournaments() {
  return tournaments;
}

export function getSelectedParryggTournament(): ParryggTournament | undefined {
  if (!currentTournament) {
    return undefined;
  }

  const tournament: ParryggTournament = { ...currentTournament };
  const events = tournamentSlugToEventIds
    .get(getSlug(tournament))!
    .map((eventId) => {
      const event: ParryggEvent = { ...idToEvent.get(eventId)! };
      event.phasesList = (eventIdToPhaseIds.get(eventId) || []).map(
        (phaseId) => {
          const phase: ParryggPhase = { ...idToPhase.get(phaseId)! };
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
  event?: SelectedParryggEvent;
  phase?: SelectedParryggPhase;
  bracket?: SelectedParryggBracket;
} {
  const selectedEvent = idToEvent.get(selectedEventId!);
  const selectedPhase = idToPhase.get(selectedPhaseId!);
  const selectedBracket = idToBracket.get(selectedBracketId!);
  let event;
  let phase;
  let bracket;
  if (currentTournament) {
    if (selectedEvent) {
      event = {
        id: selectedEvent.id,
        name: selectedEvent.name,
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

export function setSelectedParryggSetChain({
  event,
  phase,
  bracket,
}: ParryggSetChain) {
  selectedEventId = event?.id;
  selectedPhaseId = phase?.id;
  selectedBracketId = bracket?.id;
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
  // Tournament is already set in currentTournament
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
  result: ParryggSetResult,
): Promise<Set | undefined> {
  const matchResult = createMatchResultFromParryggSetResult(result);

  const request = new SetMatchResultRequest();
  request.setId(setId);
  request.setResult(matchResult);

  await matchClient.setMatchResult(request, createAuthMetadata(apiKey));
  return getSelectedParryggSet();
}
