// calc.js — Calculation engine for 器高式野帳 (Instrument Height Method Field Book)
// Pure functions, zero DOM dependency.

/**
 * Round to 3 decimal places (mm precision).
 * @param {number|null} value
 * @returns {number|null}
 */
function roundM(value) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return null;
  }
  return Math.round(value * 1000) / 1000;
}

/**
 * Format a value for display.
 * @param {number|null} value  — value in metres
 * @param {"m"|"mm"} displayMode
 * @returns {string}
 */
function formatValue(value, displayMode) {
  if (value === null || value === undefined) {
    return "";
  }
  if (displayMode === "mm") {
    return String(Math.round(value * 1000));
  }
  // displayMode "m" (default)
  return value.toFixed(3);
}

/**
 * Parse user input string into a number in metres.
 * @param {string|null|undefined} str
 * @param {"m"|"mm"} displayMode
 * @returns {number|null}
 */
function parseInput(str, displayMode) {
  if (str === null || str === undefined || String(str).trim() === "") {
    return null;
  }
  const num = Number(str);
  if (Number.isNaN(num)) {
    return null;
  }
  if (displayMode === "mm") {
    return roundM(num / 1000);
  }
  // displayMode "m"
  return roundM(num);
}

/**
 * Create a new empty row with a unique id.
 * @returns {{ id: string, point: string, bs: number|null, fs: number|null,
 *             gh: number|null, fh: number|null, ih: number|null,
 *             diff: number|null, manualFields: string[] }}
 */
function createRow() {
  return {
    id: crypto.randomUUID(),
    point: "",
    bs: null,
    fs: null,
    gh: null,
    fh: null,
    ih: null,
    diff: null,
    manualFields: [],
  };
}

/**
 * Helper: is a number usable for arithmetic?
 * @param {*} v
 * @returns {boolean}
 */
function isNum(v) {
  return v !== null && v !== undefined && !Number.isNaN(v);
}

/**
 * Recalculate all derived fields for an array of rows.
 *
 * Pure function — returns a new array with new row objects.
 * Fields filled: ih, gh (when not manual), diff.
 *
 * Rules (top-to-bottom):
 *  1. GH determination (priority):
 *     a. manualFields includes "gh" → keep manual value
 *     b. FS entered and valid IH exists → GH = IH(current) - FS
 *     c. Otherwise → null
 *  2. IH determination:
 *     a. BS entered and GH determined → IH = GH + BS (new instrument height)
 *     b. No BS → carry forward previous IH (not displayed in cell)
 *  3. Diff: GH - FH if both exist, else null
 *  4. Transfer point (BS + FS on same row):
 *     GH computed from OLD IH first, then new IH = GH + BS
 *
 * @param {Array<Object>} rows
 * @returns {Array<Object>} — new array of new row objects
 */
function recalculate(rows) {
  let prevIH = null; // carried-forward instrument height

  return rows.map((row) => {
    const out = { ...row };
    const manual = Array.isArray(row.manualFields) ? row.manualFields : [];

    // --- GH determination ---
    let gh = null;
    if (manual.includes("gh")) {
      // Manual GH — keep whatever value the user set
      gh = isNum(row.gh) ? row.gh : null;
    } else if (isNum(row.fs) && isNum(prevIH)) {
      // Computed GH from current (old) IH
      gh = roundM(prevIH - row.fs);
    }
    out.gh = gh;

    // --- IH determination ---
    let newIH = prevIH; // default: carry forward
    if (isNum(row.bs) && isNum(gh)) {
      newIH = roundM(gh + row.bs);
    }
    // IH is stored on the row only when BS is entered (new setup)
    out.ih = isNum(row.bs) && isNum(gh) ? newIH : null;

    // Update carried IH for next rows
    prevIH = isNum(newIH) ? newIH : prevIH;

    // --- Diff ---
    out.diff = isNum(gh) && isNum(row.fh) ? roundM(gh - row.fh) : null;

    return out;
  });
}
