/** @jest-environment node */
import { contextSetId, contextTournament } from './context';

const id = '01a0bc51-736d-761d-b6ed-042418c5cd14';
test('Parry context keeps UUID identity and tournament namespace', () => {
  const context = {
    startgg: {
      tournament: { parryId: id },
      set: { id: null, internalId: id.toUpperCase() },
    },
  };
  expect(contextSetId(context)).toBe(id);
  expect(contextTournament(context)).toBe(`parry:${id}`);
});
test('Start.gg keeps numeric identity and event slug', () => {
  const context = {
    startgg: {
      set: { id: 123, internalId: id },
      event: { slug: 'tournament/weekly/event/singles' },
    },
  };
  expect(contextSetId(context)).toBe('123');
  expect(contextTournament(context)).toBe('tournament/weekly');
});
test('legacy Parry context requires fresh copy and missing identities fail', () => {
  expect(() =>
    contextTournament({ startgg: { set: { id: null, internalId: id } } }),
  ).toThrow('Copy this Parry set again');
  expect(() =>
    contextSetId({ startgg: { set: { id: null, internalId: '12' } } }),
  ).toThrow();
});
