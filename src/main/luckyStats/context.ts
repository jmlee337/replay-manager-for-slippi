const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function contextSetId(context: any): string {
  const set = context?.startgg?.set;
  if (/^[1-9][0-9]{0,19}$/.test(String(set?.id))) return String(set.id);
  if (set?.id == null && uuid.test(String(set?.internalId)))
    return String(set.internalId).toLowerCase();
  throw new Error('A confirmed set ID is required.');
}
export function contextTournament(context: any): string {
  const setId = contextSetId(context);
  if (uuid.test(setId)) {
    const id = context?.startgg?.tournament?.parryId;
    if (!uuid.test(String(id)))
      throw new Error(
        'Copy this Parry set again to include its tournament ID.',
      );
    return `parry:${String(id).toLowerCase()}`;
  }
  const slug = String(context?.startgg?.event?.slug || '').match(
    /^tournament\/([^/]+)\/event\//,
  )?.[1];
  if (!slug) throw new Error('The context must include a tournament slug.');
  return `tournament/${slug}`;
}
