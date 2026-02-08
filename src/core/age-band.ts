type AgeBandRange = {
  start: number;
  end: number;
  label: string;
};

const pad2 = (value: number) => String(value).padStart(2, "0");

export const normalizeAgeBand = (value: string | null) => {
  if (!value) return "";
  const match = value.match(/(\d{1,2})\s*-\s*(\d{1,2})/);
  if (!match) return value.trim();
  const start = pad2(Number(match[1]));
  const end = pad2(Number(match[2]));
  return `${start}-${end}`;
};

export const parseAgeBandRange = (value: string | null): AgeBandRange => {
  const raw = value ?? "";
  const match = raw.match(/(\d{1,2})\s*-\s*(\d{1,2})/);
  if (!match) {
    const normalized = normalizeAgeBand(raw);
    return {
      start: Number.MAX_SAFE_INTEGER,
      end: Number.MAX_SAFE_INTEGER,
      label: normalized || raw.trim(),
    };
  }
  const start = Number(match[1]);
  const end = Number(match[2]);
  return {
    start,
    end,
    label: normalizeAgeBand(raw),
  };
};

export const sortAgeBandList = (bands: string[]) => {
  return [...bands].sort((a, b) => {
    const aRange = parseAgeBandRange(a);
    const bRange = parseAgeBandRange(b);
    if (aRange.start !== bRange.start) return aRange.start - bRange.start;
    if (aRange.end !== bRange.end) return aRange.end - bRange.end;
    return aRange.label.localeCompare(bRange.label);
  });
};
