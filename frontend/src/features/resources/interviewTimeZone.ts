interface WallTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

export class InvalidWorkspaceWallTimeError extends Error {
  constructor() {
    super("That local time does not exist in the workspace time zone because of daylight saving time. Choose another time.");
    this.name = "InvalidWorkspaceWallTimeError";
  }
}

function formatter(timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}

function wallTimeParts(value: Date, timeZone: string): WallTimeParts {
  const values = Object.fromEntries(
    formatter(timeZone)
      .formatToParts(value)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
  };
}

function parseWallTime(value: string): WallTimeParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const parts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
  };
  const normalized = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute),
  );
  if (
    normalized.getUTCFullYear() !== parts.year ||
    normalized.getUTCMonth() + 1 !== parts.month ||
    normalized.getUTCDate() !== parts.day ||
    normalized.getUTCHours() !== parts.hour ||
    normalized.getUTCMinutes() !== parts.minute
  ) {
    return null;
  }
  return parts;
}

function sameWallTime(left: WallTimeParts, right: WallTimeParts) {
  return (
    left.year === right.year &&
    left.month === right.month &&
    left.day === right.day &&
    left.hour === right.hour &&
    left.minute === right.minute
  );
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function instantToWorkspaceInput(value: string, timeZone: string) {
  const parts = wallTimeParts(new Date(value), timeZone);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

export function workspaceInputToInstant(value: string, timeZone: string) {
  const desired = parseWallTime(value);
  if (!desired) throw new InvalidWorkspaceWallTimeError();
  const wallTimeAsUtc = Date.UTC(
    desired.year,
    desired.month - 1,
    desired.day,
    desired.hour,
    desired.minute,
  );
  const offsets = new Set<number>();
  for (let hours = -48; hours <= 48; hours += 6) {
    const sample = new Date(wallTimeAsUtc + hours * 60 * 60 * 1_000);
    const sampleWall = wallTimeParts(sample, timeZone);
    offsets.add(
      Date.UTC(
        sampleWall.year,
        sampleWall.month - 1,
        sampleWall.day,
        sampleWall.hour,
        sampleWall.minute,
      ) - sample.getTime(),
    );
  }
  const matches = [...offsets]
    .map((offset) => new Date(wallTimeAsUtc - offset))
    .filter((candidate) => sameWallTime(wallTimeParts(candidate, timeZone), desired))
    .sort((left, right) => left.getTime() - right.getTime());
  if (matches.length === 0) throw new InvalidWorkspaceWallTimeError();
  return matches[0].toISOString();
}
