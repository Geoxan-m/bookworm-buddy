type Props = {
  value: number; // 0-5
  size?: number;
  onChange?: (v: number) => void;
  className?: string;
};

const DRAGON_PATH =
  "M5745 5969 c-58 -33 -58 -68 -1 -190 91 -195 100 -352 32 -553 -20 -61 -34 -116 -32 -123 12 -31 60 -7 149 74 26 24 51 41 56 38 40 -24 54 -326 22 -480 -71 -344 -337 -596 -629 -595 -271 1 -531 196 -596 447 -31 121 -18 233 43 367 37 81 38 101 10 117 -29 15 -72 2 -209 -62 -705 -332 -1097 -858 -1212 -1624 -20 -136 -17 -539 5 -690 85 -575 348 -1181 621 -1433 116 -107 135 -83 68 85 -113 284 -127 457 -50 594 56 100 182 127 319 70 122 -51 120 -53 88 109 -67 328 19 752 207 1016 295 417 976 362 1197 -97 57 -117 71 -189 65 -322 -8 -157 -52 -271 -221 -572 -233 -414 -303 -620 -301 -890 1 -117 5 -156 27 -237 105 -397 481 -799 905 -970 l107 -43 335 -2 335 -2 -125 43 c-482 165 -795 418 -971 782 -126 261 -138 534 -35 767 46 104 107 181 270 337 363 349 430 421 470 501 49 100 60 188 46 351 -20 241 39 402 188 512 259 190 629 178 849 -27 250 -234 377 -709 303 -1136 -29 -164 -26 -168 68 -122 134 67 285 47 346 -46 86 -132 71 -314 -53 -612 -26 -64 -46 -122 -44 -128 20 -60 176 109 315 342 381 640 512 1458 339 2127 -151 582 -508 1021 -1046 1283 -220 107 -323 135 -359 99 -23 -23 -20 -37 22 -106 134 -221 114 -399 -67 -579 -164 -163 -422 -262 -607 -231 -247 41 -446 287 -499 617 -22 136 -18 376 8 401 3 3 48 -16 100 -42 128 -64 154 -40 111 105 -88 297 -357 576 -681 704 -87 34 -248 49 -288 26z m473 -325 c25 -17 82 -91 82 -106 0 -18 -60 34 -89 77 -32 48 -30 55 7 29z";

function Dragon({ filled, size }: { filled: boolean; size: number }) {
  const color = filled ? "#F5B821" : "#D9D9D9";
  return (
    <svg
      viewBox="330 48 600 606"
      width={size}
      height={size}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <g transform="translate(0,652) scale(0.1,-0.1)" fill={color} stroke="none">
        <path d={DRAGON_PATH} />
      </g>
    </svg>
  );
}

export function DragonRating({ value, size = 18, onChange, className }: Props) {
  const interactive = !!onChange;
  return (
    <div className={`inline-flex items-center gap-0.5 ${className ?? ""}`}>
      {[1, 2, 3, 4, 5].map((n) =>
        interactive ? (
          <button
            key={n}
            type="button"
            onClick={() => onChange?.(n === value ? 0 : n)}
            className="transition-transform hover:scale-110"
            aria-label={`${n}/5`}
          >
            <Dragon filled={n <= value} size={size} />
          </button>
        ) : (
          <Dragon key={n} filled={n <= value} size={size} />
        ),
      )}
    </div>
  );
}
