export type Book = {
  id: string;
  isbn: string;
  title: string;
  titleEl?: string;
  author: string;
  genre: string;
  series?: string;
  /** Raw volume indicator from the source, e.g. "3" or "Τόμος 2". */
  seriesNumber?: string | number;
  publisher?: string;
  publishedYear?: number;
  languageCode?: string;
  /** Transient provider popularity (log scale), never persisted or invented. */
  popularity?: number;
  coverUrl: string;
  description: string;
  descriptionEl?: string;
};

export type ShopLink = {
  shop: string;
  url: string;
};

/** Second-hand bookshops. Links only — availability and prices are not verified. */
export const USED_SHOPS: ShopLink[] = [
  { shop: "Metabook.gr", url: "https://www.metabook.gr" },
  { shop: "Biblionet", url: "https://www.biblionet.gr" },
  { shop: "Παλαιοβιβλιοπωλείο Σπανός", url: "https://www.spanosrarebooks.gr" },
  { shop: "Booktopia", url: "https://www.booktopia.gr" },
  { shop: "Skroutz (μεταχειρισμένα)", url: "https://www.skroutz.gr" },
];
