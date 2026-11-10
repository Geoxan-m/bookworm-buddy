import type { Lang } from "@/lib/i18n";

export type GenreKey =
  | "fantasy"
  | "scifi"
  | "horror"
  | "mystery"
  | "thriller"
  | "romance"
  | "historical"
  | "biography"
  | "nonfiction"
  | "poetry"
  | "children"
  | "ya"
  | "classics"
  | "comics"
  | "other";

const LABELS: Record<GenreKey, { en: string; el: string }> = {
  fantasy: { en: "Fantasy", el: "Φαντασίας" },
  scifi: { en: "Sci-Fi", el: "Επιστ. Φαντασίας" },
  horror: { en: "Horror", el: "Τρόμου" },
  mystery: { en: "Mystery", el: "Μυστηρίου" },
  thriller: { en: "Thriller", el: "Θρίλερ" },
  romance: { en: "Romance", el: "Ρομαντικά" },
  historical: { en: "Historical", el: "Ιστορικά" },
  biography: { en: "Biography", el: "Βιογραφίες" },
  nonfiction: { en: "Non-Fiction", el: "Δοκίμια" },
  poetry: { en: "Poetry", el: "Ποίηση" },
  children: { en: "Children", el: "Παιδικά" },
  ya: { en: "Young Adult", el: "Νεανικά" },
  classics: { en: "Classics", el: "Κλασικά" },
  comics: { en: "Comics", el: "Κόμικς" },
  other: { en: "Other", el: "Άλλα" },
};

const RULES: Array<[GenreKey, RegExp]> = [
  ["fantasy", /fantasy|φαντασ|magic|μαγ|dragon|δράκ/i],
  ["scifi", /sci-?fi|science fiction|επιστημ.*φαντασ|space|διαστημ|cyberpunk|dystop|δυστοπ/i],
  ["horror", /horror|τρόμ|gothic|γοτθ|supernatural/i],
  ["thriller", /thriller|θρίλερ|suspense/i],
  ["mystery", /mystery|μυστ|detective|αστυν|crime|έγκλημα|noir/i],
  ["romance", /romance|ρομαντ|love story|αγάπ/i],
  ["historical", /historical|ιστορικ/i],
  ["biography", /biograph|βιογραφ|memoir|απομνημ|autobiog|αυτοβιογρ/i],
  ["poetry", /poetry|ποίησ|ποιήμα|poem/i],
  ["children", /children|παιδικ|kids/i],
  ["ya", /young adult|\bya\b|νεανικ|εφηβικ/i],
  ["classics", /classic|κλασικ/i],
  ["comics", /comic|κόμικ|manga|μάνγκα|graphic novel/i],
  [
    "nonfiction",
    /non-?fiction|δοκίμι|essay|philosoph|φιλοσοφ|self.?help|αυτοβοήθ|history|ιστορία|science|επιστήμ/i,
  ],
];

export function canonicalGenre(raw: string | undefined): GenreKey {
  if (!raw) return "other";
  for (const [key, rx] of RULES) if (rx.test(raw)) return key;
  return "other";
}

export function genreLabel(key: GenreKey, lang: Lang): string {
  return LABELS[key][lang];
}
