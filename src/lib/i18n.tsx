import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "el";

type Dict = Record<string, { en: string; el: string }>;

export const dict: Dict = {
  tagline: { en: "Devour your reading life", el: "Καταβρόχθισε τη ζωή του βιβλιόφιλου" },
  mode: { en: "mode", el: "λειτουργία" },
  search_placeholder: {
    en: "Search a book, author, or series…",
    el: "Αναζήτησε βιβλίο, συγγραφέα ή σειρά…",
  },
  find: { en: "Search", el: "Αναζήτηση" },

  currently_reading: { en: "Currently reading", el: "Διαβάζω τώρα" },
  no_notes: { en: "No notes yet. Jot something down ✍️", el: "Δεν υπάρχουν σημειώσεις ακόμη ✍️" },
  note_placeholder: { en: "A thought, a quote…", el: "Μια σκέψη, ένα απόσπασμα…" },
  save: { en: "Save", el: "Αποθήκευση" },
  delete: { en: "Delete", el: "Διαγραφή" },
  tab_read: { en: "Read", el: "Διαβασμένα" },
  tab_want: { en: "Up next", el: "Επόμενα" },
  tab_suggest: { en: "For you", el: "Για σένα" },
  tab_shops: { en: "Shops", el: "Τιμές" },
  tab_used: { en: "Used", el: "Μεταχ/να" },
  search_for: { en: "Search", el: "Αναζήτηση" },
  clear: { en: "Clear", el: "Καθαρισμός" },
  no_matches: {
    en: "No matches. Try another title or author.",
    el: "Δεν βρέθηκαν αποτελέσματα. Δοκίμασε άλλο τίτλο ή συγγραφέα.",
  },
  empty_grid: {
    en: "Nothing here yet. Use search to add books.",
    el: "Τίποτα εδώ ακόμη. Χρησιμοποίησε την αναζήτηση.",
  },
  more_from: { en: "More from", el: "Περισσότερα από τη σειρά" },
  more_by: { en: "More by", el: "Άλλα του/της" },
  details: { en: "Details", el: "Λεπτομέρειες" },
  reading_now: { en: "Reading now", el: "Διαβάζω Τώρα" },
  read: { en: "Read", el: "Λίστα Διαβασμένων" },
  want: { en: "Want", el: "Προς Ανάγνωση" },
  available_shops: { en: "Find it at", el: "Βρες το σε" },
  shop_links_note: {
    en: "Opens a search for this book at each shop",
    el: "Ανοίγει αναζήτηση για το βιβλίο σε κάθε κατάστημα",
  },
  used_for: { en: "Second-hand bookshops", el: "Παλαιοβιβλιοπωλεία" },

  // Auth
  sign_in: { en: "Sign in", el: "Σύνδεση" },
  sign_up: { en: "Sign up", el: "Εγγραφή" },
  sign_out: { en: "Sign out", el: "Αποσύνδεση" },
  email: { en: "Email", el: "Email" },
  password: { en: "Password", el: "Κωδικός" },
  create_account: { en: "Create your account", el: "Δημιούργησε λογαριασμό" },
  welcome_back: { en: "Welcome back", el: "Καλώς ήρθες ξανά" },
  have_account: { en: "Already have an account?", el: "Έχεις ήδη λογαριασμό;" },
  no_account: { en: "No account yet?", el: "Δεν έχεις λογαριασμό;" },
  not_now: { en: "Not now", el: "Όχι τώρα" },

  footer: {
    en: "🍴 Made for readers who eat books for breakfast",
    el: "🍴 Για αναγνώστες που τρώνε βιβλία για πρωινό",
  },
  my_library: { en: "Reading now", el: "Διαβάζω Τώρα" },
  no_current_book: {
    en: "Pick a book and tap «Reading now» to start.",
    el: "Διάλεξε ένα βιβλίο και πάτα «Διαβάζω Τώρα» για να ξεκινήσεις.",
  },
  your_comment: { en: "Your comment", el: "Το σχόλιό σου" },
  read_list_title: { en: "Books you've read", el: "Βιβλία που έχεις διαβάσει" },
  write_impressions: { en: "Write your impressions…", el: "Γράψε τις εντυπώσεις σου…" },
  searching: { en: "Searching…", el: "Αναζήτηση…" },
  online_results: { en: "Online results", el: "Αποτελέσματα online" },
  add_to_read: { en: "Read", el: "Διαβασμένο" },
  add_to_want: { en: "Up next", el: "Επόμενο" },
  add_to_buy: { en: "Buy", el: "Αγορά" },
  tab_buy: { en: "Shopping list", el: "Λίστα Αγορών" },
  empty_library: {
    en: "No books read yet. Pick from the lists below.",
    el: "Δεν έχεις διαβάσει βιβλία ακόμη. Διάλεξε από τις λίστες παρακάτω.",
  },
  priority_want: { en: "From your want-to-read", el: "Από το «θέλω να διαβάσω»" },
  priority_buy: { en: "From your want-to-buy", el: "Από το «θέλω να αγοράσω»" },
  priority_suggest: { en: "Suggestions", el: "Προτάσεις" },
  sign_in_google: { en: "Continue with Google", el: "Συνέχεια με Google" },
  or: { en: "or", el: "ή" },
  syncing: { en: "Syncing…", el: "Συγχρονισμός…" },
  ai_for_you: { en: "Picked for you by AI", el: "Επιλεγμένα για εσένα από AI" },
  ai_thinking: { en: "Thinking…", el: "Σκέφτομαι…" },
  ai_empty_history: {
    en: "Read at least one book and AI suggestions will appear here.",
    el: "Διάβασε τουλάχιστον ένα βιβλίο και θα εμφανιστούν προτάσεις AI εδώ.",
  },
  ai_rate_limit: {
    en: "Too many requests. Try again in a minute.",
    el: "Πολλά αιτήματα. Δοκίμασε ξανά σε λίγο.",
  },
  ai_payment: {
    en: "AI credits exhausted. Add credits in workspace settings.",
    el: "Τα AI credits εξαντλήθηκαν. Πρόσθεσε στις ρυθμίσεις.",
  },
  ai_error: { en: "Couldn't load suggestions.", el: "Δεν ήταν δυνατή η φόρτωση προτάσεων." },
  refresh: { en: "Refresh", el: "Ανανέωση" },
  check_shop: { en: "Search shop", el: "Αναζήτηση στο κατάστημα" },
  in_list: { en: "Currently in", el: "Βρίσκεται σε" },
  move_to: { en: "Move to", el: "Μετακίνηση σε" },
  remove_book: { en: "Remove", el: "Αφαίρεση" },
  confirm_remove_title: { en: "Remove this book?", el: "Αφαίρεση του βιβλίου;" },
  confirm_remove_desc: {
    en: "It will be removed from your lists. Your notes and rating are kept.",
    el: "Θα αφαιρεθεί από τις λίστες σου. Οι σημειώσεις και η βαθμολογία διατηρούνται.",
  },
  cancel: { en: "Cancel", el: "Άκυρο" },
  manual_add: { en: "Can't find it? Add manually", el: "Δεν το βρίσκεις; Πρόσθεσέ το χειροκίνητα" },
  manual_title: { en: "Add a book manually", el: "Χειροκίνητη προσθήκη βιβλίου" },
  manual_field_title: { en: "Title", el: "Τίτλος" },
  manual_field_author: { en: "Author", el: "Συγγραφέας" },
  manual_field_genre: { en: "Genre", el: "Είδος" },
  manual_field_cover: { en: "Cover URL (https)", el: "Σύνδεσμος εξωφύλλου (https)" },
  manual_field_list: { en: "Add to", el: "Προσθήκη σε" },
  manual_err_required: { en: "Required", el: "Υποχρεωτικό" },
  manual_err_too_long: { en: "Too long", el: "Πολύ μεγάλο" },
  manual_err_isbn: { en: "Invalid ISBN", el: "Μη έγκυρο ISBN" },
  manual_err_https: { en: "Must be an https:// link", el: "Πρέπει να είναι σύνδεσμος https://" },
  manual_added: { en: "Book added", el: "Το βιβλίο προστέθηκε" },
  manual_duplicate: { en: "Already in your library", el: "Υπάρχει ήδη στη βιβλιοθήκη σου" },
  toast_removed: { en: "Removed", el: "Αφαιρέθηκε" },
  sync_error: {
    en: "Couldn't sync with your account",
    el: "Ο συγχρονισμός με τον λογαριασμό απέτυχε",
  },

  toast_added_read: { en: "Added to Reading", el: "Προστέθηκε στα «Διαβάζω»" },
  toast_added_want: { en: "Added to Up next", el: "Προστέθηκε στα «Επόμενα»" },
  toast_added_buy: { en: "Added to Buy", el: "Προστέθηκε στα «Αγορά»" },
  toast_set_current: { en: "Now reading", el: "Διαβάζεις τώρα" },
  review_prompt: {
    en: "Want to write your impressions for this book?",
    el: "Θέλεις να γράψεις τις εντυπώσεις σου για αυτό το βιβλίο;",
  },
  your_rating: { en: "Your rating", el: "Βαθμολογία" },
  rate_this_book: { en: "Rate this book", el: "Άφησε μια κριτική" },
  edit_review: { en: "Edit", el: "Επεξεργασία" },

  review_placeholder: { en: "What did you think?", el: "Πώς σου φάνηκε;" },
  save_review: { en: "Save review", el: "Αποθήκευση κριτικής" },
  skip: { en: "Skip", el: "Παράλειψη" },
  congrats_book: {
    en: "Congrats! You finished another book!",
    el: "Συγχαρητήρια! Ολοκλήρωσες ένα ακόμη βιβλίο!",
  },
  search_hint: { en: "Type at least 4 characters…", el: "Πληκτρολόγησε τουλάχιστον 4 χαρακτήρες…" },
  no_suggestions: { en: "No suggestions", el: "Καμία πρόταση" },
};

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (k: keyof typeof dict) => string };
const I18nCtx = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("el");
  useEffect(() => {
    const saved =
      typeof window !== "undefined" ? (localStorage.getItem("be_lang") as Lang | null) : null;
    if (saved === "en" || saved === "el") setLangState(saved);
  }, []);
  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.lang = lang;
  }, [lang]);

  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") localStorage.setItem("be_lang", l);
  };
  const t = (k: keyof typeof dict) => dict[k]?.[lang] ?? String(k);
  return <I18nCtx.Provider value={{ lang, setLang, t }}>{children}</I18nCtx.Provider>;
}

export function useI18n() {
  const c = useContext(I18nCtx);
  if (!c) throw new Error("useI18n outside provider");
  return c;
}
