/**
 * Layout classes for the book-status action buttons inside the book dialog.
 *
 * The dialog is capped at max-w-lg, so switching to four columns at `sm:`
 * squeezed the Greek labels ("Λίστα Διαβασμένων", "Προς Ανάγνωση") past their
 * own button edges. A fixed two-column grid (2x2 for the four actions) keeps
 * every label readable at any viewport width, and the button classes let long
 * labels wrap instead of overflowing.
 */

/** Two equal, shrinkable columns at every viewport size. */
export const ACTION_GRID_CLASS = "grid grid-cols-2 gap-2";

/** Wrapping, centred, compact-leading buttons that grow past a 40px floor. */
export const ACTION_BUTTON_CLASS =
  "h-auto min-h-10 whitespace-normal break-words px-3 py-2 text-center leading-tight";

/** Icons that never collapse when the label wraps to two lines. */
export const ACTION_ICON_CLASS = "mr-1 h-3.5 w-3.5 shrink-0";
