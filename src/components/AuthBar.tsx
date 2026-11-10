import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { LogIn, LogOut } from "lucide-react";
import { lovable } from "@/integrations/lovable";

export function AuthBar() {
  const { t } = useI18n();
  const { user, signIn, signUp, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) {
    return (
      <Button
        size="sm"
        variant="ghost"
        className="h-8 rounded-full px-3 text-[11px]"
        onClick={() => signOut()}
      >
        <LogOut className="mr-1 h-3 w-3" /> {t("sign_out")}
      </Button>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const r = mode === "in" ? await signIn(email, password) : await signUp(email, password);
    setBusy(false);
    if (r.error) setErr(r.error);
    else setOpen(false);
  };

  const google = async () => {
    setBusy(true);
    setErr(null);
    const r = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (r.error) {
      setErr(r.error instanceof Error ? r.error.message : String(r.error));
      setBusy(false);
    }
  };

  return (
    <>
      <Button size="sm" className="h-8 rounded-full px-3 text-[11px]" onClick={() => setOpen(true)}>
        <LogIn className="mr-1 h-3 w-3" /> {t("sign_in")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{mode === "in" ? t("welcome_back") : t("create_account")}</DialogTitle>
          </DialogHeader>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={google}
            disabled={busy}
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
              />
            </svg>
            {t("sign_in_google")}
          </Button>
          <div className="my-2 flex items-center gap-2 text-[10px] uppercase text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> {t("or")}{" "}
            <div className="h-px flex-1 bg-border" />
          </div>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="email" className="text-xs">
                {t("email")}
              </Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password" className="text-xs">
                {t("password")}
              </Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {err && <p className="text-xs text-destructive">{err}</p>}
            <Button type="submit" className="w-full" disabled={busy}>
              {mode === "in" ? t("sign_in") : t("sign_up")}
            </Button>
            <button
              type="button"
              className="w-full text-center text-xs text-muted-foreground underline"
              onClick={() => {
                setErr(null);
                setMode(mode === "in" ? "up" : "in");
              }}
            >
              {mode === "in" ? t("no_account") : t("have_account")}
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
