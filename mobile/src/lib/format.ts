const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

export function formatDrawDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  if (!isValidIsoDate(isoDate)) return isoDate;
  return `${MONTHS[month - 1]} ${day}, ${year}`;
}

export function isValidIsoDate(value: string): boolean {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  );
}

export function formatDrawTime(time: string): string {
  const [hourText, minute = '00'] = time.slice(0, 5).split(':');
  const hour = Number(hourText);
  if (!Number.isFinite(hour)) return time;
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minute} ${suffix}`;
}

export function formatPeso(value: string | number): string {
  const amount = Number(String(value).replace(/[,₱]/g, ''));
  if (!Number.isFinite(amount) || amount <= 0) return 'Not reported';
  const hasCentavos = !Number.isInteger(amount);
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: hasCentavos ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat('en-PH').format(value);
}

export function relativeResultPage(offset: number): string {
  if (offset === 0) return 'Latest draw dates';
  if (offset === 1) return '1 draw date back';
  return `${offset} draw dates back`;
}
