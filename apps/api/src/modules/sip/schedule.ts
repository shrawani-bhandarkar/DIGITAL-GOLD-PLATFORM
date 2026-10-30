export type SipFrequency = "Monthly" | "Weekly";

export function addSipMonths(date: string, months: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const targetMonth = month - 1 + months;
  const targetYear = year + Math.floor(targetMonth / 12);
  const monthIndex = targetMonth % 12;
  const lastDay = new Date(Date.UTC(targetYear, monthIndex + 1, 0)).getUTCDate();
  return new Date(Date.UTC(targetYear, monthIndex, Math.min(day, lastDay))).toISOString().slice(0, 10);
}

export function addSipFrequency(date: string, frequency: SipFrequency): string {
  if (frequency === "Weekly") {
    const next = new Date(`${date}T00:00:00.000Z`);
    next.setUTCDate(next.getUTCDate() + 7);
    return next.toISOString().slice(0, 10);
  }
  return addSipMonths(date, 1);
}

export function buildSipSchedule(
  startDate: string,
  frequency: SipFrequency,
  durationMonths: number,
): string[] {
  if (!Number.isInteger(durationMonths) || durationMonths < 1 || durationMonths > 60) {
    throw new RangeError("SIP duration must be between 1 and 60 months.");
  }
  const maturityBoundary = addSipMonths(startDate, durationMonths);
  if (frequency === "Monthly") {
    return Array.from({ length: durationMonths }, (_unused, index) => addSipMonths(startDate, index + 1));
  }
  const dates: string[] = [];
  let date = addSipFrequency(startDate, frequency);
  while (date <= maturityBoundary) {
    dates.push(date);
    date = addSipFrequency(date, frequency);
  }
  if (dates.length === 0 || dates.length > 300) {
    throw new RangeError("SIP schedule could not be calculated.");
  }
  return dates;
}

export function divideRounded(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator / 2n) / denominator;
}
