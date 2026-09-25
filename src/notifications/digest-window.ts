const TIME_ZONE = 'America/Sao_Paulo';
const UTC_OFFSET = '-03:00';
const DAY_MS = 24 * 60 * 60 * 1000;

export function previousDayWindow(now = new Date()) {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
  }).format(now);
  const end = new Date(`${today}T00:00:00${UTC_OFFSET}`);
  const start = new Date(end.getTime() - DAY_MS);
  const label = new Intl.DateTimeFormat('pt-BR', {
    timeZone: TIME_ZONE,
  }).format(start);
  return { start, end, label, key: today };
}
