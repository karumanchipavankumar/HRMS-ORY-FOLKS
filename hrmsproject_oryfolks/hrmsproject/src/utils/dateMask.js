/**
 * Date mask helpers shared by the DateInput component.
 *
 * Kept free of JSX/React so the segment rules (dd → 2, mm → 2, yyyy → 4) can be
 * reasoned about — and tested — on their own.
 */

export const CURRENT_YEAR = new Date().getFullYear();
export const DEFAULT_MIN_YEAR = 1900;
export const DEFAULT_MAX_YEAR = CURRENT_YEAR + 10;

export const MASKS = {
  date: { digits: 8, segments: [2, 2, 4], placeholder: "dd-mm-yyyy", nativeType: "date" },
  month: { digits: 6, segments: [2, 4], placeholder: "mm-yyyy", nativeType: "month" },
};

export const getMask = (mode) => MASKS[mode] || MASKS.date;

export const onlyDigits = (value) => String(value ?? "").replace(/\D/g, "");

const pad = (num, size) => String(num).padStart(size, "0");

// "5" can only mean the 5th, so pad it and let typing carry on into the month.
const autoPadSegments = (digits, mode) => {
  let d = digits;
  if (mode === "month") {
    if (d.length >= 1 && d[0] > "1") d = `0${d}`;
    return d;
  }
  if (d.length >= 1 && d[0] > "3") d = `0${d}`;
  if (d.length >= 3 && d[2] > "1") d = `${d.slice(0, 2)}0${d.slice(2)}`;
  return d;
};

// Group digits into segments, adding a separator only once the next segment has
// started — that keeps backspace working across the dashes.
const groupDigits = (digits, mode) => {
  const parts = [];
  let cursor = 0;
  for (const length of getMask(mode).segments) {
    if (cursor >= digits.length) break;
    parts.push(digits.slice(cursor, cursor + length));
    cursor += length;
  }
  return parts.join("-");
};

/**
 * Sanitize raw typed/pasted text into the mask: digits only, each segment
 * capped at its own length. Anything past the last segment is dropped here, so
 * a 5th year digit never reaches the value.
 */
export const maskInput = (raw, mode = "date") => {
  const digits = autoPadSegments(onlyDigits(raw), mode).slice(0, getMask(mode).digits);
  return groupDigits(digits, mode);
};

/** ISO ("2020-07-01" / "2020-07") → display ("01-07-2020" / "07-2020"). */
export const isoToDisplay = (iso, mode = "date") => {
  const value = String(iso ?? "").slice(0, 10);
  if (mode === "month") {
    const match = /^(\d{4})-(\d{2})$/.exec(value.slice(0, 7));
    return match ? `${match[2]}-${match[1]}` : "";
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : "";
};

/**
 * Display → ISO, or "" when the text isn't a complete, real, in-range date.
 * Enforces dd 01-31, mm 01-12 and the year bounds, and rejects days that don't
 * exist in the given month (31-02, 30-02, 29-02 in a common year).
 */
export const displayToIso = (
  text,
  mode = "date",
  minYear = DEFAULT_MIN_YEAR,
  maxYear = DEFAULT_MAX_YEAR
) => {
  const digits = onlyDigits(text);
  if (digits.length !== getMask(mode).digits) return "";

  const year = Number(mode === "month" ? digits.slice(2) : digits.slice(4));
  const month = Number(mode === "month" ? digits.slice(0, 2) : digits.slice(2, 4));
  const day = mode === "month" ? 1 : Number(digits.slice(0, 2));

  if (year < minYear || year > maxYear) return "";
  if (month < 1 || month > 12) return "";
  if (day < 1 || day > 31) return "";

  const parsed = new Date(year, month - 1, day);
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) {
    return "";
  }

  return mode === "month"
    ? `${pad(year, 4)}-${pad(month, 2)}`
    : `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
};
