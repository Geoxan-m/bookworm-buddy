import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

export function LanguageSwitcher() {
  const { lang, setLang } = useI18n();
  return (
    <div className="flex items-center gap-1 rounded-full border bg-card/70 p-0.5 backdrop-blur">
      <Button
        size="sm"
        variant={lang === "en" ? "default" : "ghost"}
        className="h-7 rounded-full px-3 text-[11px]"
        onClick={() => setLang("en")}
      >
        EN
      </Button>
      <Button
        size="sm"
        variant={lang === "el" ? "default" : "ghost"}
        className="h-7 rounded-full px-3 text-[11px]"
        onClick={() => setLang("el")}
      >
        ΕΛ
      </Button>
    </div>
  );
}
