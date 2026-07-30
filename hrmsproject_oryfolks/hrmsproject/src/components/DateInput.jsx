import { useEffect, useRef, useState } from "react";
import { Calendar } from "lucide-react";
import {
  CURRENT_YEAR,
  DEFAULT_MAX_YEAR,
  DEFAULT_MIN_YEAR,
  displayToIso,
  getMask,
  isoToDisplay,
  maskInput,
  onlyDigits,
} from "../utils/dateMask";

/**
 * DateInput — shared masked date field used everywhere a date is typed.
 *
 * Native <input type="date"> lets Chrome's year segment grow to six digits
 * (275760 is the platform maximum), so typing could produce values such as
 * 01-07-222222. This masks a plain text input instead:
 *
 *   • dd → 2 digits, mm → 2 digits, yyyy → 4 digits — extra keystrokes are
 *     blocked at input time, not truncated after the fact.
 *   • Segments auto-advance: the separator appears once a segment is full, and
 *     a leading zero is added when a digit can't start a valid day/month
 *     ("5" → "05-").
 *   • Digits only — letters and symbols never reach the value.
 *   • Blur discards anything that isn't a real calendar date inside the year
 *     bounds, mirroring how the native control drops incomplete input.
 *
 * The calendar button still opens the browser's native picker, and onChange /
 * onBlur hand back an ISO value in a { target: { name, value } } shape, so
 * existing form handlers keep working unchanged.
 *
 * Props beyond the usual input ones:
 *   mode     "date" (dd-mm-yyyy, ISO yyyy-mm-dd) or "month" (mm-yyyy, ISO yyyy-mm)
 *   min/max  ISO bounds handed to the native calendar picker
 *   minYear/maxYear  sanity bounds enforced on typed input (default 1900 … +10y)
 */
export { CURRENT_YEAR };

export default function DateInput({
  value = "",
  onChange,
  onBlur,
  name,
  id,
  min,
  max,
  minYear = DEFAULT_MIN_YEAR,
  maxYear = DEFAULT_MAX_YEAR,
  mode = "date",
  disabled = false,
  className = "",
  placeholder,
  ...rest
}) {
  const mask = getMask(mode);
  const inputRef = useRef(null);
  const pickerRef = useRef(null);
  const [text, setText] = useState(() => isoToDisplay(value, mode));

  // Mirror external value changes (form reset, picker, a parent rejecting the
  // date) without clobbering a half-typed date, which reads back as empty ISO.
  useEffect(() => {
    const current = displayToIso(text, mode, minYear, maxYear);
    if ((value || "") !== current) setText(isoToDisplay(value, mode));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, mode]);

  const emit = (handler, iso) => {
    if (!handler) return;
    const target = { name, id, value: iso, type: mask.nativeType };
    handler({ target, currentTarget: target });
  };

  const handleKeyDown = (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key.length !== 1) return;

    // Letters and symbols never make it into a date field.
    if (!/\d/.test(event.key)) {
      event.preventDefault();
      return;
    }
    // Every segment is full — block the keystroke outright rather than accept a
    // digit that would be discarded.
    const input = event.target;
    const hasSelection = input.selectionStart !== input.selectionEnd;
    if (!hasSelection && onlyDigits(text).length >= mask.digits) {
      event.preventDefault();
    }
  };

  const handleChange = (event) => {
    const masked = maskInput(event.target.value, mode);
    setText(masked);
    const iso = displayToIso(masked, mode, minYear, maxYear);
    // Match the native control: only a complete date (or a clear) reaches the form.
    if (iso || (value || "") !== "") emit(onChange, iso);
  };

  const handleBlur = () => {
    const iso = displayToIso(text, mode, minYear, maxYear);
    if (!iso && text) {
      // Incomplete or out of range ("35-13-1200") — dropped, as the native input does.
      setText("");
      if ((value || "") !== "") emit(onChange, "");
    } else if (iso) {
      setText(isoToDisplay(iso, mode));
    }
    if (onBlur) emit(onBlur, iso);
  };

  const handlePickerChange = (event) => {
    const iso = event.target.value || "";
    setText(isoToDisplay(iso, mode));
    emit(onChange, iso);
  };

  const openPicker = () => {
    const picker = pickerRef.current;
    if (!picker || disabled) return;
    try {
      picker.showPicker();
    } catch {
      // Browsers without showPicker() (or that block it) fall back to focusing
      // the field so the date can still be typed.
      inputRef.current?.focus();
    }
  };

  return (
    <div className="relative w-full">
      <input
        {...rest}
        ref={inputRef}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        name={name}
        id={id}
        value={text}
        disabled={disabled}
        placeholder={placeholder || mask.placeholder}
        onKeyDown={handleKeyDown}
        onChange={handleChange}
        onBlur={handleBlur}
        className={`${className} pr-10`}
      />
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        onClick={openPicker}
        aria-label="Open calendar"
        title="Open calendar"
        className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-blue/40 hover:text-brand-blue transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Calendar size={16} />
      </button>
      {/* Native control kept purely as the calendar picker — never typed into. */}
      <input
        ref={pickerRef}
        type={mask.nativeType}
        tabIndex={-1}
        aria-hidden="true"
        value={value || ""}
        min={min}
        max={max}
        disabled={disabled}
        onChange={handlePickerChange}
        className="absolute right-3 bottom-0 w-px h-px opacity-0 pointer-events-none"
      />
    </div>
  );
}
