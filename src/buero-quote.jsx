import React, { useState, useEffect, useMemo, useCallback } from "react";

/* ------------------------------------------------------------------ */
/* Design-Tokens                                                       */
/* ------------------------------------------------------------------ */

const T = {
  bg: "#EEF3F9",
  surface: "#FFFFFF",
  tile: "#F2F6FB",
  tileSoft: "#F7FAFD",
  ink: "#0F1B2D",
  inkSoft: "#64748B",
  inkMuted: "#9AA8BC",
  line: "#E4EBF3",
  accent: "#2F80ED",
  accentSoft: "#E7F0FE",
  accentInk: "#1B5FBF",
  teal: "#2CB5A0",
  dark: "#101B2B",
  success: "#1FA971",
  warn: "#C98A2E",
  alert: "#D0491F",
  radiusCard: 24,
  radiusTile: 16,
  radiusCell: 14,
  shadow: "0 4px 20px rgba(15,27,45,0.06)",
  shadowLift: "0 18px 50px rgba(15,27,45,0.18)",
};

const card = {
  background: T.surface,
  borderRadius: T.radiusCard,
  boxShadow: T.shadow,
};

const tile = {
  background: T.tile,
  borderRadius: T.radiusTile,
};

const sectionLabel = {
  color: T.inkMuted,
  textTransform: "uppercase",
  letterSpacing: "0.14em",
  fontSize: 11,
  fontWeight: 600,
};

/* ------------------------------------------------------------------ */
/* Status-Definitionen                                                 */
/* ------------------------------------------------------------------ */

const STATUS = [
  { id: "buero", label: "Büro", short: "Büro", cat: "A" },
  { id: "berufsschule", label: "Berufsschule / Berufsakademie", short: "Schule", cat: "A" },
  { id: "dienstreise", label: "Dienstreise", short: "Reise", cat: "A" },
  { id: "seminar", label: "Seminar / Kurs / Lehrgang", short: "Seminar", cat: "A" },
  { id: "dienstlich_abw", label: "Sonstige dienstliche Abwesenheit", short: "Dienstl.", cat: "A" },

  { id: "mobil", label: "Mobiles Arbeiten", short: "Mobil", cat: "B" },

  { id: "samstagsarbeit", label: "Samstagsarbeit", short: "Sa-Arbeit", cat: "C" },
  { id: "urlaub", label: "Urlaub, Gleittag", short: "Urlaub", cat: "C" },
  { id: "krank", label: "Krankheit, Reha, Kur", short: "Krank", cat: "C" },
  { id: "sonstige_abw", label: "Sonstige Abwesenheit (z. B. Kinderkrankengeld)", short: "Sonstige", cat: "C" },
  { id: "feiertag", label: "Feiertag", short: "Feiertag", cat: "C" },
];

const BY_ID = STATUS.reduce((acc, s) => ((acc[s.id] = s), acc), {});
const QUICK = ["buero", "mobil", "urlaub", "krank"];
const CAT_A = STATUS.filter((s) => s.cat === "A");
const CAT_B = STATUS.filter((s) => s.cat === "B");
const CAT_C = STATUS.filter((s) => s.cat === "C");

const CAT_STYLE = {
  A: { background: T.accentSoft, color: T.accentInk, borderColor: "#D3E4FD" },
  B: { background: "#E1F3F0", color: "#1C7A6B", borderColor: "#CCE8E2" },
  C: { background: T.tile, color: T.inkMuted, borderColor: T.line },
};
const CAT_DOT = { A: T.accent, B: T.teal, C: "#CBD5E1" };
const CAT_NAME = {
  A: "Nicht mobiles Arbeiten – zählt als Anwesenheit",
  B: "Mobiles Arbeiten – zählt zur Basis, nicht zum Zähler",
  C: "Fällt komplett aus der Quote",
};

const FONT_STACK = 'Inter, "SF Pro Text", "Helvetica Neue", Helvetica, Arial, system-ui, -apple-system, sans-serif';
const HEAD_STACK = 'Poppins, Inter, "SF Pro Display", "Helvetica Neue", Helvetica, Arial, system-ui, sans-serif';
const FONT_HREF =
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@600;700&display=swap";

/** Lädt die Schriften einmalig nach, damit die Oberfläche wie die Design-Vorlage aussieht. */
function usePoppins() {
  useEffect(() => {
    try {
      if (document.getElementById("poppins-font")) return;
      const link = document.createElement("link");
      link.id = "poppins-font";
      link.rel = "stylesheet";
      link.href = FONT_HREF;
      document.head.appendChild(link);
    } catch (err) {
      /* Fällt auf den Schriftstack zurück */
    }
  }, []);
}

const WD_SHORT = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const MONTHS_SHORT = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

const BASE_WEEK = { 1: "buero", 2: "buero", 3: "mobil", 4: "buero", 5: "mobil" };

const DEFAULT_SETTINGS = {
  target: 60,
  // Standardwochen mit Gültigkeitsbeginn. Schlüssel je Woche = ISO-Wochentag 1 (Mo) … 5 (Fr).
  weeks: [{ from: "0000-00", week: BASE_WEEK }],
};

const monthKey = (y, m) => `${y}-${pad(m + 1)}`;

/** Die Standardwoche, die in einem bestimmten Monat gilt. */
function weekForMonth(settings, y, m) {
  const key = monthKey(y, m);
  const list = (settings.weeks || []).filter((w) => w.from <= key).sort((a, b) => (a.from < b.from ? -1 : 1));
  return list.length ? list[list.length - 1].week : BASE_WEEK;
}

/** Erster Monat, den eine Änderung an der Standardwoche verändern darf. */
function nextMonthOf(date) {
  const y = date.getMonth() === 11 ? date.getFullYear() + 1 : date.getFullYear();
  const m = date.getMonth() === 11 ? 0 : date.getMonth() + 1;
  return { y, m, key: monthKey(y, m) };
}

/* ------------------------------------------------------------------ */
/* Datum & Feiertage                                                   */
/* ------------------------------------------------------------------ */

const pad = (n) => String(n).padStart(2, "0");
const keyOf = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
const deDate = (k) => {
  const [y, m, d] = k.split("-");
  return `${d}.${m}.${y}`;
};
const isoDow = (date) => (date.getDay() === 0 ? 7 : date.getDay()); // 1 = Mo … 7 = So

function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function shiftKey(date, days) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
  return keyOf(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Gesetzliche Feiertage in Hamburg */
function hamburgHolidays(year) {
  const e = easterSunday(year);
  return {
    [keyOf(year, 0, 1)]: "Neujahr",
    [shiftKey(e, -2)]: "Karfreitag",
    [shiftKey(e, 1)]: "Ostermontag",
    [keyOf(year, 4, 1)]: "Tag der Arbeit",
    [shiftKey(e, 39)]: "Christi Himmelfahrt",
    [shiftKey(e, 50)]: "Pfingstmontag",
    [keyOf(year, 9, 3)]: "Tag der Deutschen Einheit",
    [keyOf(year, 9, 31)]: "Reformationstag",
    [keyOf(year, 11, 25)]: "1. Weihnachtstag",
    [keyOf(year, 11, 26)]: "2. Weihnachtstag",
  };
}

/* ------------------------------------------------------------------ */
/* Speicher                                                            */
/* ------------------------------------------------------------------ */

const SETTINGS_KEY = "attendance:settings";
const yearKey = (y) => `attendance:${y}`;

async function loadKey(key) {
  try {
    const res = await window.storage.get(key, false);
    if (!res || !res.value) return null;
    return JSON.parse(res.value);
  } catch (err) {
    return null; // Schlüssel existiert noch nicht oder Speicher nicht erreichbar
  }
}

async function saveKey(key, value) {
  try {
    const res = await window.storage.set(key, JSON.stringify(value), false);
    return !!res;
  } catch (err) {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Berechnung                                                          */
/* ------------------------------------------------------------------ */

/** Status eines Tages: Override > Feiertag > Standardwoche > leer */
function resolveStatus(k, dow, overrides, defaultWeek, holidays) {
  if (overrides[k]) return overrides[k];
  if (holidays[k]) return "feiertag";
  if (dow === 6 || dow === 7) return null; // Sa/So standardmäßig leer
  return defaultWeek[dow] || null;
}

function buildMonth(year, month, overrides, defaultWeek, holidays) {
  const days = [];
  const total = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= total; d++) {
    const date = new Date(year, month, d);
    const dow = isoDow(date);
    const k = keyOf(year, month, d);
    const status = resolveStatus(k, dow, overrides, defaultWeek, holidays);
    days.push({
      key: k,
      day: d,
      dow,
      date,
      status,
      cat: status ? BY_ID[status].cat : null,
      holiday: holidays[k] || null,
      manual: !!overrides[k],
    });
  }
  return days;
}

function tally(days) {
  let a = 0;
  let b = 0;
  for (const d of days) {
    if (d.cat === "A") a++;
    else if (d.cat === "B") b++;
  }
  const base = a + b;
  return { a, b, base, quote: base ? (a / base) * 100 : null };
}

/* ------------------------------------------------------------------ */
/* Kleine Bausteine                                                    */
/* ------------------------------------------------------------------ */

function Chip({ cat, children }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
      style={{ ...CAT_STYLE[cat], borderStyle: "solid", borderWidth: 1, fontWeight: 500 }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: CAT_DOT[cat] }} />
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Anmeldung                                                           */
/* ------------------------------------------------------------------ */

const inputBox = {
  background: T.tile,
  borderRadius: 12,
  borderStyle: "solid",
  borderWidth: 1,
  borderColor: T.line,
  color: T.ink,
};
const primaryBtn = {
  background: T.accent,
  color: "#FFFFFF",
  borderRadius: 999,
  fontWeight: 600,
  boxShadow: "0 8px 24px rgba(47,128,237,0.28)",
};
const ghostBtnBase = {
  borderRadius: 999,
  borderStyle: "solid",
  borderWidth: 1,
  borderColor: T.line,
  color: T.ink,
  background: T.surface,
  fontWeight: 500,
};

function AuthField({ label, ...rest }) {
  return (
    <label className="block">
      <span style={sectionLabel}>{label}</span>
      <input {...rest} className="mt-2 h-12 w-full px-3 text-sm" style={inputBox} />
    </label>
  );
}

function Msg({ tone, children }) {
  const styles = {
    error: { background: "#FDECEA", color: T.alert },
    ok: { background: "#E6F6EF", color: "#12654A" },
  };
  return (
    <div className="px-4 py-3 text-sm" style={{ ...styles[tone], borderRadius: T.radiusTile, lineHeight: 1.5 }}>
      {children}
    </div>
  );
}

function Shell({ title, subtitle, children }) {
  usePoppins();
  return (
    <div className="min-h-screen" style={{ background: T.bg, color: T.ink, fontFamily: FONT_STACK }}>
      <div className="mx-auto max-w-sm px-4 pt-20">
        <div className="mb-6 text-center">
          <div style={{ fontFamily: HEAD_STACK, fontWeight: 700, fontSize: 28, letterSpacing: "-0.03em" }}>{title}</div>
          {subtitle && (
            <p className="mt-1 text-sm" style={{ color: T.inkMuted }}>
              {subtitle}
            </p>
          )}
        </div>
        <div className="space-y-3 p-5" style={card}>
          {children}
        </div>
      </div>
    </div>
  );
}

function AuthScreen() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const login = async () => {
    setBusy(true);
    setMsg(null);
    const eingabe = email.trim();
    let adresse = eingabe;
    if (!eingabe.includes("@")) {
      // Benutzername: zugehörige E-Mail über die Datenbank auflösen
      const { data, error } = await window.SB.rpc("email_for_login", { login: eingabe });
      if (error || !data) {
        setBusy(false);
        setMsg({ tone: "error", text: "Anmeldung fehlgeschlagen. Prüfe Benutzername und Passwort." });
        return;
      }
      adresse = data;
    }
    const { error } = await window.SB.auth.signInWithPassword({ email: adresse, password: pw });
    setBusy(false);
    if (error) setMsg({ tone: "error", text: "Anmeldung fehlgeschlagen. Prüfe deine Eingaben." });
  };

  const reset = async () => {
    setBusy(true);
    setMsg(null);
    const { error } = await window.SB.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin + window.location.pathname,
    });
    setBusy(false);
    setMsg(
      error
        ? { tone: "error", text: "Die E-Mail konnte nicht versendet werden." }
        : { tone: "ok", text: "E-Mail ist unterwegs. Sieh auch im Spam-Ordner nach." }
    );
  };

  return (
    <Shell title="Büroquote" subtitle="Melde dich an, um deine Quote zu sehen.">
      <AuthField
        label={mode === "login" ? "Benutzername oder E-Mail" : "E-Mail"}
        type="text"
        autoComplete="username"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      {mode === "login" && (
        <AuthField
          label="Passwort"
          type="password"
          autoComplete="current-password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && email && pw) login();
          }}
        />
      )}
      {msg && <Msg tone={msg.tone}>{msg.text}</Msg>}
      {mode === "login" ? (
        <React.Fragment>
          <button
            type="button"
            onClick={login}
            disabled={busy || !email || !pw}
            className="min-h-12 w-full text-sm"
            style={{ ...primaryBtn, opacity: busy || !email || !pw ? 0.5 : 1 }}
          >
            {busy ? "Anmelden …" : "Anmelden"}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("reset");
              setMsg(null);
            }}
            className="w-full text-center text-xs font-semibold"
            style={{ color: T.accent, background: "transparent" }}
          >
            Passwort vergessen
          </button>
        </React.Fragment>
      ) : (
        <React.Fragment>
          <button
            type="button"
            onClick={reset}
            disabled={busy || !email}
            className="min-h-12 w-full text-sm"
            style={{ ...primaryBtn, opacity: busy || !email ? 0.5 : 1 }}
          >
            {busy ? "Senden …" : "Link zum Zurücksetzen senden"}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setMsg(null);
            }}
            className="w-full text-center text-xs font-medium"
            style={{ color: T.inkMuted, background: "transparent" }}
          >
            Zurück zur Anmeldung
          </button>
        </React.Fragment>
      )}
    </Shell>
  );
}

function SetPasswordScreen({ onDone }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const short = pw.length > 0 && pw.length < 8;
  const mismatch = pw2.length > 0 && pw !== pw2;

  const save = async () => {
    setBusy(true);
    setMsg(null);
    const { error } = await window.SB.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) setMsg({ tone: "error", text: "Das Passwort wurde nicht gesetzt: " + error.message });
    else onDone();
  };

  return (
    <Shell title="Passwort festlegen" subtitle="Danach meldest du dich damit immer an.">
      <AuthField
        label="Neues Passwort"
        type="password"
        autoComplete="new-password"
        value={pw}
        onChange={(e) => setPw(e.target.value)}
      />
      <AuthField
        label="Wiederholen"
        type="password"
        autoComplete="new-password"
        value={pw2}
        onChange={(e) => setPw2(e.target.value)}
      />
      {short && <Msg tone="error">Mindestens 8 Zeichen.</Msg>}
      {mismatch && <Msg tone="error">Die beiden Eingaben stimmen nicht überein.</Msg>}
      {msg && <Msg tone={msg.tone}>{msg.text}</Msg>}
      <button
        type="button"
        onClick={save}
        disabled={busy || pw.length < 8 || pw !== pw2}
        className="min-h-12 w-full text-sm"
        style={{ ...primaryBtn, opacity: busy || pw.length < 8 || pw !== pw2 ? 0.5 : 1 }}
      >
        {busy ? "Speichern …" : "Passwort speichern"}
      </button>
    </Shell>
  );
}

/* Konto-Block im Reiter Einstellungen */
function KontoBlock({ email }) {
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const change = async () => {
    setBusy(true);
    setMsg(null);
    const { error } = await window.SB.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) setMsg({ tone: "error", text: error.message });
    else {
      setMsg({ tone: "ok", text: "Passwort geändert." });
      setPw("");
    }
  };

  const signOut = async () => {
    window.BQStore.reset();
    await window.SB.auth.signOut();
  };

  return (
    <div style={{ borderTop: `1px solid ${T.line}`, paddingTop: 20 }}>
      <div style={sectionLabel}>Konto</div>
      <p className="mb-3 mt-1 text-xs" style={{ color: T.inkMuted }}>
        Angemeldet als {email}
      </p>
      {open ? (
        <div className="mb-2 space-y-2 p-4" style={tile}>
          <AuthField
            label="Neues Passwort"
            type="password"
            autoComplete="new-password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
          />
          {msg && <Msg tone={msg.tone}>{msg.text}</Msg>}
          <button
            type="button"
            onClick={change}
            disabled={busy || pw.length < 8}
            className="min-h-11 w-full text-sm"
            style={{ ...primaryBtn, opacity: busy || pw.length < 8 ? 0.5 : 1 }}
          >
            {busy ? "Speichern …" : "Speichern"}
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setMsg(null);
              setPw("");
            }}
            className="w-full text-center text-xs font-medium"
            style={{ color: T.inkMuted, background: "transparent" }}
          >
            Abbrechen
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="mb-2 min-h-12 w-full text-sm" style={ghostBtnBase}>
          Passwort ändern
        </button>
      )}
      <button
        type="button"
        onClick={signOut}
        className="min-h-12 w-full text-sm"
        style={{ ...ghostBtnBase, color: T.alert, borderColor: "#F3D5CD" }}
      >
        Abmelden
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Benutzernamen festlegen                                             */
/* ------------------------------------------------------------------ */

const USERNAME_RE = /^[A-Za-z0-9._-]{3,20}$/;

function UsernameScreen({ onDone }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const invalid = name.length > 0 && !USERNAME_RE.test(name.trim());

  const save = async () => {
    setBusy(true);
    setMsg(null);
    const { data: u } = await window.SB.auth.getUser();
    const { error } = await window.SB.from("profiles").insert({ user_id: u.user.id, username: name.trim() });
    setBusy(false);
    if (error) {
      setMsg({
        tone: "error",
        text: error.code === "23505" ? "Dieser Benutzername ist schon vergeben." : error.message,
      });
      return;
    }
    onDone(name.trim());
  };

  return (
    <Shell title="Benutzername" subtitle="Damit meldest du dich künftig an.">
      <AuthField
        label="Benutzername"
        type="text"
        autoComplete="username"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && USERNAME_RE.test(name.trim())) save();
        }}
      />
      <p className="text-xs" style={{ color: T.inkMuted }}>
        3 bis 20 Zeichen, erlaubt sind Buchstaben, Ziffern, Punkt, Bindestrich und Unterstrich.
      </p>
      {invalid && <Msg tone="error">Der Benutzername enthält unerlaubte Zeichen oder ist zu kurz.</Msg>}
      {msg && <Msg tone={msg.tone}>{msg.text}</Msg>}
      <button
        type="button"
        onClick={save}
        disabled={busy || !USERNAME_RE.test(name.trim())}
        className="min-h-12 w-full text-sm"
        style={{ ...primaryBtn, opacity: busy || !USERNAME_RE.test(name.trim()) ? 0.5 : 1 }}
      >
        {busy ? "Speichern …" : "Weiter"}
      </button>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* Admin-Ansicht                                                       */
/* ------------------------------------------------------------------ */

/** Erster Monat, der in die Jahresquote eingeht (2026 startet im September). */
const adminStartMonth = (year) => (year === 2026 ? 8 : 0);

/** Einstellungen aus der gespeicherten Zeile lesen, altes Format inbegriffen. */
function settingsFromData(data) {
  const raw = data[SETTINGS_KEY];
  if (!raw) return DEFAULT_SETTINGS;
  return {
    target: raw.target != null ? raw.target : DEFAULT_SETTINGS.target,
    weeks: raw.weeks || [{ from: "0000-00", week: { ...BASE_WEEK, ...(raw.defaultWeek || {}) } }],
  };
}

function AdminView({ onSignOut }) {
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [raw, setRaw] = useState(null);
  const [error, setError] = useState(null);

  usePoppins();

  // Einmal alles laden, danach nur noch umrechnen
  useEffect(() => {
    let alive = true;
    (async () => {
      const [p, a] = await Promise.all([
        window.SB.from("profiles").select("user_id, username, is_admin"),
        window.SB.from("attendance").select("user_id, data"),
      ]);
      if (!alive) return;
      if (p.error || a.error) {
        setError((p.error || a.error).message);
        return;
      }
      setRaw({ profiles: p.data || [], attendance: a.data || [] });
    })();
    return () => {
      alive = false;
    };
  }, []);

  const rows = useMemo(() => {
    if (!raw) return null;
    const year = cursor.y;
    const month = cursor.m;
    const byId = {};
    raw.attendance.forEach((r) => {
      byId[r.user_id] = r.data || {};
    });
    const holidays = hamburgHolidays(year);
    const start = adminStartMonth(year);
    return raw.profiles
      .filter((u) => !u.is_admin)
      .map((u) => {
        const data = byId[u.user_id] || {};
        const settings = settingsFromData(data);
        const overrides = data[yearKey(year)] || {};
        const monat = tally(buildMonth(year, month, overrides, weekForMonth(settings, year, month), holidays));
        let ja = 0;
        let jb = 0;
        for (let m = start; m <= 11; m++) {
          const s = tally(buildMonth(year, m, overrides, weekForMonth(settings, year, m), holidays));
          ja += s.a;
          jb += s.b;
        }
        return {
          id: u.user_id,
          name: u.username,
          a: monat.a,
          base: monat.base,
          monat: monat.quote,
          jahr: ja + jb ? (ja / (ja + jb)) * 100 : null,
        };
      })
      .sort((x, y) => x.name.localeCompare(y.name, "de"));
  }, [raw, cursor]);

  // Vor September 2026 gibt es keine Daten
  const atStart = cursor.y === 2026 && cursor.m === adminStartMonth(2026);
  const step = (delta) => {
    setCursor((c) => {
      const m = c.m + delta;
      if (m < 0) return { y: c.y - 1, m: 11 };
      if (m > 11) return { y: c.y + 1, m: 0 };
      return { y: c.y, m };
    });
  };

  const ok = (q) => q !== null && q >= 60;
  const pillStyle = (q) =>
    q === null
      ? { background: T.tile, color: T.inkMuted }
      : ok(q)
      ? { background: "#E6F6EF", color: "#12654A" }
      : { background: "#FDECEA", color: T.alert };
  // Abschneiden statt runden, damit die Anzeige die 60er-Schwelle nie überspringt
  const zeige = (q) => (q === null ? "–" : `${Math.floor(q)} %`);

  const pill = {
    borderRadius: 999,
    padding: "6px 0",
    width: 64,
    textAlign: "center",
    fontFamily: HEAD_STACK,
    fontWeight: 700,
    fontSize: 15,
    letterSpacing: "-0.02em",
  };

  const team = rows && rows.length ? rows.reduce((acc, r) => acc + (ok(r.monat) ? 1 : 0), 0) : 0;
  const teamA = rows ? rows.reduce((acc, r) => acc + r.a, 0) : 0;
  const teamBase = rows ? rows.reduce((acc, r) => acc + r.base, 0) : 0;
  const teamQuote = teamBase ? (teamA / teamBase) * 100 : null;

  const navBtn = { background: T.tile, color: T.ink };

  const spinner = (
    <div className="flex justify-center py-10">
      <div
        className="h-8 w-8 animate-spin rounded-full"
        style={{ border: `2px solid ${T.line}`, borderTopColor: T.accent }}
      />
    </div>
  );

  return (
    <div className="min-h-screen pb-10" style={{ background: T.bg, color: T.ink, fontFamily: FONT_STACK }}>
      <div className="mx-auto max-w-md px-4 pt-5 sm:max-w-2xl">
        {/* Kopfkarte: Monatswahl und Team-Kennzahl --------------------- */}
        <div className="p-5" style={card}>
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => step(-1)}
              disabled={atStart}
              aria-label="Vorheriger Monat"
              className="flex h-11 w-11 items-center justify-center rounded-full text-xl"
              style={{ ...navBtn, opacity: atStart ? 0.35 : 1 }}
            >
              ‹
            </button>
            <div className="text-center">
              <div className="text-sm font-medium" style={{ color: T.inkSoft }}>
                {MONTHS[cursor.m]} {cursor.y}
              </div>
              {(cursor.y !== today.getFullYear() || cursor.m !== today.getMonth()) && (
                <button
                  type="button"
                  onClick={() => setCursor({ y: today.getFullYear(), m: today.getMonth() })}
                  className="mt-0.5 rounded-full px-2 py-0.5 text-xs font-semibold"
                  style={{ color: T.accent, background: "transparent" }}
                >
                  Heute
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Nächster Monat"
              className="flex h-11 w-11 items-center justify-center rounded-full text-xl"
              style={navBtn}
            >
              ›
            </button>
          </div>

          <div className="mt-3 text-center">
            <div style={sectionLabel}>Teamquote</div>
            <div
              className="mt-1 text-4xl tabular-nums"
              style={{
                color: teamQuote === null ? T.inkMuted : ok(teamQuote) ? T.success : T.alert,
                fontFamily: HEAD_STACK,
                fontWeight: 700,
                letterSpacing: "-0.035em",
                lineHeight: 1.1,
              }}
            >
              {teamQuote === null ? "–" : `${Math.floor(teamQuote)} %`}
            </div>
          </div>

          <p
            className="mt-3 truncate px-3 py-1.5 text-center"
            style={{ ...tile, color: T.inkSoft, fontSize: 12, lineHeight: 1.6 }}
          >
            {rows === null
              ? "Wird geladen …"
              : rows.length === 0
              ? "Noch keine Mitarbeiter angelegt."
              : `${team} von ${rows.length} über 60 %`}
          </p>
        </div>

        {/* Mitarbeiterliste ------------------------------------------- */}
        <div className="mt-3 p-5" style={card}>
          <div className="flex items-end justify-between pb-3">
            <span style={sectionLabel}>Mitarbeiter</span>
            <span className="flex gap-2">
              <span className="text-center" style={{ ...sectionLabel, width: 64 }}>
                {MONTHS_SHORT[cursor.m]}
              </span>
              <span className="text-center" style={{ ...sectionLabel, width: 64 }}>
                Jahr
              </span>
            </span>
          </div>

          {error && <Msg tone="error">{error}</Msg>}
          {!error && rows === null && spinner}

          {rows !== null &&
            rows.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between py-3"
                style={{ borderTop: `1px solid ${T.line}` }}
              >
                <div className="min-w-0 pr-3">
                  <div className="truncate text-sm" style={{ color: T.ink, fontWeight: 600 }}>
                    {r.name}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <span className="tabular-nums" style={{ ...pill, ...pillStyle(r.monat) }}>
                    {zeige(r.monat)}
                  </span>
                  <span className="tabular-nums" style={{ ...pill, ...pillStyle(r.jahr) }}>
                    {zeige(r.jahr)}
                  </span>
                </div>
              </div>
            ))}
        </div>

        <button type="button" onClick={onSignOut} className="mt-3 min-h-12 w-full text-sm" style={ghostBtnBase}>
          Abmelden
        </button>
      </div>
    </div>
  );
}

function StatusButton({ status, active, onPick }) {
  const s = BY_ID[status];
  return (
    <button
      type="button"
      onClick={() => onPick(status)}
      className="flex min-h-12 w-full items-center gap-3 border px-3 py-2 text-left text-sm transition active:scale-95"
      style={{
        ...CAT_STYLE[s.cat],
        borderStyle: "solid",
        borderWidth: 1,
        borderRadius: T.radiusTile,
        fontWeight: 500,
        outline: active ? `2px solid ${T.accent}` : "none",
        outlineOffset: active ? 1 : 0,
      }}
    >
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: CAT_DOT[s.cat] }} />
      <span className="leading-tight">{s.label}</span>
      <span className="ml-auto text-xs font-semibold" style={{ opacity: 0.55 }}>
        {s.cat}
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Tagesauswahl (Bottom Sheet)                                         */
/* ------------------------------------------------------------------ */

function DaySheet({ day, defaultStatus, onPick, onReset, onClose }) {
  if (!day) return null;
  const isSaturday = day.dow === 6;
  const isSunday = day.dow === 7;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Schließen"
        onClick={onClose}
        className="absolute inset-0"
        style={{ background: "rgba(15,27,45,0.35)" }}
      />
      <div
        className="relative mx-2 mb-2 w-full max-w-md overflow-y-auto p-5 pb-8 sm:mb-6"
        style={{
          background: T.surface,
          borderRadius: T.radiusCard,
          boxShadow: T.shadowLift,
          maxHeight: "calc(100% - 1rem)",
        }}
      >
        <div className="mb-1 flex items-start justify-between gap-3">
          <div>
            <div
              className="text-lg"
              style={{ color: T.ink, fontFamily: HEAD_STACK, fontWeight: 600, letterSpacing: "-0.02em" }}
            >
              {WD_SHORT[day.dow - 1]}, {deDate(day.key)}
            </div>
            <div className="text-xs" style={{ color: T.inkMuted }}>
              {day.holiday
                ? `Feiertag: ${day.holiday}`
                : day.manual
                ? "Manuell gesetzt"
                : day.status
                ? "Aus Standardwoche"
                : "Kein Status"}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-10 rounded-full px-4 text-sm font-medium"
            style={{ background: T.tile, color: T.ink }}
          >
            Fertig
          </button>
        </div>

        <div className="mb-4 mt-3 grid grid-cols-2 gap-2">
          {QUICK.map((id) => {
            const s = BY_ID[id];
            return (
              <button
                key={id}
                type="button"
                onClick={() => onPick(id)}
                className="min-h-14 border text-sm font-semibold transition active:scale-95"
                style={{
                  ...CAT_STYLE[s.cat],
                  borderStyle: "solid",
                  borderWidth: 1,
                  borderRadius: T.radiusTile,
                  outline: day.status === id ? `2px solid ${T.accent}` : "none",
                  outlineOffset: day.status === id ? 1 : 0,
                }}
              >
                {s.short}
              </button>
            );
          })}
        </div>

        {isSunday && (
          <p className="mb-3 px-4 py-3 text-xs" style={{ ...tile, color: T.inkSoft }}>
            Sonntage bleiben normalerweise leer.
          </p>
        )}
        {isSaturday && (
          <p className="mb-3 px-4 py-3 text-xs" style={{ ...tile, color: T.inkSoft }}>
            Samstagsarbeit zählt weder zum Zähler noch zur Basis.
          </p>
        )}

        {[
          ["A", CAT_A],
          ["B", CAT_B],
          ["C", CAT_C],
        ].map(([cat, list]) => (
          <div key={cat} className="mb-4">
            <div className="mb-2 flex items-baseline gap-2">
              <span
                className="inline-flex h-5 w-5 items-center justify-center rounded-md text-xs font-semibold"
                style={{ background: CAT_DOT[cat], color: "#FFFFFF" }}
              >
                {cat}
              </span>
              <span style={sectionLabel}>{CAT_NAME[cat]}</span>
            </div>
            <div className="space-y-2">
              {list.map((s) => (
                <StatusButton key={s.id} status={s.id} active={day.status === s.id} onPick={onPick} />
              ))}
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={onReset}
          className="min-h-12 w-full border px-3 text-sm font-medium"
          style={{
            borderRadius: 999,
            borderStyle: "solid",
            borderWidth: 1,
            borderColor: T.line,
            color: T.inkSoft,
            background: T.surface,
          }}
        >
          {defaultStatus ? `Zurück zum Standard (${BY_ID[defaultStatus].short})` : "Status entfernen (leer)"}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Bürotag-Rechner                                                     */
/* ------------------------------------------------------------------ */

const DAY_THRESHOLD = 0.6; // Ein Tag zählt als Bürotag ab 60 % Büroanteil
const PAUSE_STUFEN = [
  { abMin: 540, pause: 45 }, // ab 9 h
  { abMin: 360, pause: 30 }, // ab 6 h
];
function pauseFor(min) {
  const stufe = PAUSE_STUFEN.find((s) => min >= s.abMin);
  return stufe ? stufe.pause : 0;
}

function fmtMin(total) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}:${pad(m)} h`;
}

function BueroTagRechner() {
  const [mode, setMode] = useState("buero"); // "buero" = Bürozeit eingeben, "mobil" = mobile Zeit eingeben
  const [h, setH] = useState("");
  const [m, setM] = useState("");

  const entered = Math.max(0, (Number(h) || 0) * 60 + (Number(m) || 0));
  // Büro / (Büro + Zuhause) >= 0,6
  //   nach Zuhause aufgelöst:  Zuhause <= Büro × 0,4 / 0,6   (abrunden)
  //   nach Büro aufgelöst:     Büro    >= Zuhause × 0,6 / 0,4 (aufrunden)
  const officeMin = mode === "buero" ? entered : Math.ceil((entered * DAY_THRESHOLD) / (1 - DAY_THRESHOLD));
  const maxHome = mode === "buero" ? Math.floor((entered * (1 - DAY_THRESHOLD)) / DAY_THRESHOLD) : entered;
  const result = mode === "buero" ? maxHome : officeMin;
  const gesamt = officeMin + maxHome;
  const pause = pauseFor(gesamt); // Pause zählt nicht als Arbeitszeit, wird hier nur ausgewiesen
  const hasInput = entered > 0;

  const inputLabel = mode === "buero" ? "Arbeitszeit im Büro" : "Mobile Arbeitszeit";
  const resultLabel = mode === "buero" ? "Maximal zuhause" : "Mindestens im Büro";

  const inputStyle = {
    background: T.surface,
    borderRadius: 12,
    borderStyle: "solid",
    borderWidth: 1,
    borderColor: T.line,
    color: T.ink,
  };

  return (
    <div>
      <div className="relative mb-4">
        <div
          className="text-center"
          style={{ color: T.ink, fontFamily: HEAD_STACK, fontWeight: 600, fontSize: 15, letterSpacing: "-0.01em" }}
        >
          Zählt der Tag als Bürotag?
        </div>
        <button
          type="button"
          onClick={() => setMode((v) => (v === "buero" ? "mobil" : "buero"))}
          aria-label="Eingaberichtung wechseln"
          title="Eingaberichtung wechseln"
          className="absolute flex h-8 w-8 items-center justify-center rounded-full"
          style={{ right: 0, top: -2, background: T.tile, color: T.inkMuted }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="17 2 21 6 17 10" />
            <path d="M21 6H8a4 4 0 0 0-4 4" />
            <polyline points="7 22 3 18 7 14" />
            <path d="M3 18h13a4 4 0 0 0 4-4" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="p-4" style={tile}>
          <label htmlFor="bh" style={sectionLabel}>
            {inputLabel}
          </label>
          <div className="mt-3 flex items-center gap-1">
            <input
              id="bh"
              type="number"
              inputMode="numeric"
              min="0"
              max="24"
              placeholder="0"
              value={h}
              onChange={(e) => setH(e.target.value)}
              className="h-12 w-full px-2 text-center text-lg tabular-nums"
              style={inputStyle}
            />
            <span className="text-sm" style={{ color: T.inkMuted }}>
              h
            </span>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              max="59"
              placeholder="00"
              value={m}
              onChange={(e) => setM(e.target.value)}
              className="h-12 w-full px-2 text-center text-lg tabular-nums"
              style={inputStyle}
              aria-label="Minuten"
            />
            <span className="text-sm" style={{ color: T.inkMuted }}>
              min
            </span>
          </div>
        </div>

        <div
          className="p-4"
          style={{
            borderRadius: T.radiusTile,
            background: hasInput ? `linear-gradient(135deg, ${T.accent} 0%, #56A5F5 100%)` : T.tile,
            color: hasInput ? "#FFFFFF" : T.inkMuted,
            boxShadow: hasInput ? "0 8px 24px rgba(47,128,237,0.28)" : "none",
          }}
        >
          <div style={{ ...sectionLabel, color: hasInput ? "rgba(255,255,255,0.85)" : T.inkMuted }}>{resultLabel}</div>
          <div
            className="mt-3 flex h-12 items-center text-3xl tabular-nums"
            style={{ fontFamily: HEAD_STACK, fontWeight: 600, letterSpacing: "-0.03em" }}
          >
            {hasInput ? fmtMin(result) : ""}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between px-4 py-3 text-sm" style={{ ...tile, color: T.inkSoft }}>
        <span>Gesamtarbeitszeit</span>
        <span className="font-semibold tabular-nums" style={{ color: T.ink }}>
          {hasInput ? fmtMin(gesamt) : ""}
        </span>
      </div>

      {hasInput && pause > 0 && (
        <p className="mt-2 text-xs" style={{ color: T.inkMuted }}>
          Ab {pause === 45 ? 9 : 6} h Gesamtarbeitszeit {pause} min Pause einplanen — zusätzlich zu diesen Zeiten.
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Hauptkomponente                                                     */
/* ------------------------------------------------------------------ */

function BueroQuote({ email }) {
  usePoppins();
  const today = useMemo(() => new Date(), []);
  const todayKey = keyOf(today.getFullYear(), today.getMonth(), today.getDate());

  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [yearData, setYearData] = useState({}); // { 2026: { "2026-01-05": "urlaub" } }
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [sheetKey, setSheetKey] = useState(null);
  const [tab, setTab] = useState("monat");
  const [open, setOpen] = useState(false);
  const [csvText, setCsvText] = useState(null);

  /* --- Laden --------------------------------------------------------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      const [s, y] = await Promise.all([loadKey(SETTINGS_KEY), loadKey(yearKey(cursor.y))]);
      if (!alive) return;
      if (s) {
        // Altes Format (eine einzelne Standardwoche) auf das neue mit Gültigkeitsbeginn heben
        const weeks = s.weeks || [{ from: "0000-00", week: { ...BASE_WEEK, ...(s.defaultWeek || {}) } }];
        setSettings({ target: s.target ?? DEFAULT_SETTINGS.target, weeks });
      }
      setYearData((prev) => ({ ...prev, [cursor.y]: y || {} }));
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Jahr nachladen, wenn über die Jahresgrenze geblättert wird
  useEffect(() => {
    if (yearData[cursor.y] !== undefined) return;
    let alive = true;
    (async () => {
      const y = await loadKey(yearKey(cursor.y));
      if (!alive) return;
      setYearData((prev) => ({ ...prev, [cursor.y]: y || {} }));
    })();
    return () => {
      alive = false;
    };
  }, [cursor.y, yearData]);

  const overrides = yearData[cursor.y] || {};
  const holidays = useMemo(() => hamburgHolidays(cursor.y), [cursor.y]);

  /* --- Schreiben ----------------------------------------------------- */
  const writeDay = useCallback(
    async (k, status) => {
      const y = Number(k.slice(0, 4));
      const current = yearData[y] || {};
      const next = { ...current };
      if (status) next[k] = status;
      else delete next[k];
      setYearData((prev) => ({ ...prev, [y]: next }));
      const ok = await saveKey(yearKey(y), next);
      setSaveError(!ok);
    },
    [yearData]
  );

  // Änderungen an der Standardwoche wirken erst ab dem Folgemonat
  const eff = useMemo(() => nextMonthOf(today), [today]);
  const effWeek = useMemo(() => weekForMonth(settings, eff.y, eff.m), [settings, eff]);

  const writeSettings = useCallback(async (next) => {
    setSettings(next);
    const ok = await saveKey(SETTINGS_KEY, next);
    setSaveError(!ok);
  }, []);

  const writeWeekDay = useCallback(
    (dow, value) => {
      const week = { ...weekForMonth(settings, eff.y, eff.m), [dow]: value };
      const weeks = [...(settings.weeks || []).filter((w) => w.from !== eff.key), { from: eff.key, week }].sort((a, b) =>
        a.from < b.from ? -1 : 1
      );
      writeSettings({ ...settings, weeks });
    },
    [settings, eff, writeSettings]
  );

  /* --- Monatsdaten --------------------------------------------------- */
  const days = useMemo(
    () => buildMonth(cursor.y, cursor.m, overrides, weekForMonth(settings, cursor.y, cursor.m), holidays),
    [cursor.y, cursor.m, overrides, settings, holidays]
  );

  const prog = useMemo(() => tally(days), [days]);
  const target = settings.target;
  const t = target / 100;

  // Ein Tag von B nach A: Zähler +1, Nenner unverändert.
  const need = Math.max(0, Math.ceil(t * prog.base - prog.a - 1e-9));
  const puffer = Math.max(0, Math.floor(prog.a - t * prog.base + 1e-9));
  const futureB = days.filter((d) => d.cat === "B" && d.key > todayKey).length;

  const toneOf = (q) =>
    q === null ? "neutral" : q >= target - 1e-9 ? "gut" : q >= target - 5 ? "knapp" : "kritisch";
  const TONE_TEXT = {
    gut: T.success,
    knapp: T.ink,
    kritisch: T.ink,
    neutral: T.inkMuted,
  };
  const tone = toneOf(prog.quote);
  const toneClass = TONE_TEXT[tone];

  let hint;
  if (prog.base === 0) hint = "Noch keine Tage erfasst.";
  else if (need > 0 && need <= futureB)
    hint = `Noch ${need} ${need === 1 ? "Tag" : "Tage"} nötig für ${target} %.`;
  else if (need > 0) hint = `${target} % nicht mehr erreichbar – ${need} fehlen.`;
  else if (puffer > 0) hint = `Puffer: ${puffer} ${puffer === 1 ? "Tag" : "Tage"} mobil möglich.`;
  else hint = `${target} % exakt erreicht – kein Puffer.`;

  /* --- Jahresübersicht ----------------------------------------------- */
  const yearStats = useMemo(() => {
    const rows = [];
    let a = 0;
    let b = 0;
    let aIst = 0;
    let bIst = 0;
    for (let m = 0; m < 12; m++) {
      const md = buildMonth(cursor.y, m, overrides, weekForMonth(settings, cursor.y, m), holidays);
      const s = tally(md);
      const si = tally(md.filter((d) => d.key <= todayKey));
      a += s.a;
      b += s.b;
      aIst += si.a;
      bIst += si.b;
      rows.push({ m, ...s, future: md.length > 0 && md[0].key > todayKey });
    }
    return {
      rows,
      total: { a, b, base: a + b, quote: a + b ? (a / (a + b)) * 100 : null },
      istTotal: { a: aIst, b: bIst, base: aIst + bIst, quote: aIst + bIst ? (aIst / (aIst + bIst)) * 100 : null },
    };
  }, [cursor.y, overrides, settings, holidays, todayKey]);

  /* --- CSV ----------------------------------------------------------- */
  const buildCsv = () => {
    const lines = ["Datum;Status;Kategorie"];
    for (let m = 0; m < 12; m++) {
      for (const d of buildMonth(cursor.y, m, overrides, weekForMonth(settings, cursor.y, m), holidays)) {
        if (!d.status) continue;
        lines.push(`${deDate(d.key)};${BY_ID[d.status].label};${d.cat}`);
      }
    }
    return lines.join("\n");
  };

  const exportCsv = () => {
    const csv = buildCsv();
    try {
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `anwesenheit-${cursor.y}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setCsvText(csv);
    }
  };

  /* --- Navigation ---------------------------------------------------- */
  const step = (delta) => {
    setCursor((c) => {
      const m = c.m + delta;
      if (m < 0) return { y: c.y - 1, m: 11 };
      if (m > 11) return { y: c.y + 1, m: 0 };
      return { y: c.y, m };
    });
  };

  const sheetDay = sheetKey ? days.find((d) => d.key === sheetKey) : null;
  const sheetDefault = sheetDay
    ? holidays[sheetDay.key]
      ? "feiertag"
      : sheetDay.dow <= 5
      ? weekForMonth(settings, cursor.y, cursor.m)[sheetDay.dow] || null
      : null
    : null;

  if (loading) {
    return (
      <div
        className="flex min-h-64 items-center justify-center p-8"
        style={{ background: T.bg, fontFamily: FONT_STACK }}
      >
        <div className="text-center">
          <div
            className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full"
            style={{ border: `2px solid ${T.line}`, borderTopColor: T.accent }}
          />
          <p className="text-sm" style={{ color: T.inkMuted }}>
            Daten werden geladen …
          </p>
        </div>
      </div>
    );
  }

  const leading = (days[0].dow + 6) % 7; // Leerzellen bis Montag

  return (
    <div className="min-h-screen pb-10" style={{ background: T.bg, color: T.ink, fontFamily: FONT_STACK }}>
      <div className="mx-auto max-w-md px-4 pt-5 sm:max-w-2xl">
        {saveError && (
          <div
            className="mb-3 px-4 py-3 text-sm"
            style={{ background: "#FDECEA", color: T.alert, borderRadius: T.radiusTile }}
          >
            Änderung wurde nicht gespeichert. Prüfe die Verbindung und tippe den Tag erneut an.
          </div>
        )}

        {/* Kopf: Quote ------------------------------------------------- */}
        <div className="p-5" style={card}>
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Vorheriger Monat"
              className="flex h-11 w-11 items-center justify-center rounded-full text-xl"
              style={{ background: T.tile, color: T.ink }}
            >
              ‹
            </button>
            <div className="text-center">
              <div className="text-sm font-medium" style={{ color: T.inkSoft }}>
                {MONTHS[cursor.m]} {cursor.y}
              </div>
              {(cursor.y !== today.getFullYear() || cursor.m !== today.getMonth()) && (
                <button
                  type="button"
                  onClick={() => setCursor({ y: today.getFullYear(), m: today.getMonth() })}
                  className="mt-0.5 rounded-full px-2 py-0.5 text-xs font-semibold"
                  style={{ color: T.accent, background: "transparent" }}
                >
                  Heute
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Nächster Monat"
              className="flex h-11 w-11 items-center justify-center rounded-full text-xl"
              style={{ background: T.tile, color: T.ink }}
            >
              ›
            </button>
          </div>

          <div className="mt-3 text-center">
            <div
              className="text-6xl tabular-nums"
              style={{
                color: toneClass,
                fontFamily: HEAD_STACK,
                fontWeight: 700,
                letterSpacing: "-0.045em",
                lineHeight: 1.05,
              }}
            >
              {prog.quote === null ? "–" : `${Math.floor(prog.quote)} %`}
            </div>
            <div className="mt-2 text-sm" style={{ color: T.inkMuted }}>
              {prog.a} von {prog.base} Tagen
            </div>
          </div>

          <p
            className="mt-3 truncate px-3 py-1.5 text-center"
            style={{ ...tile, color: T.inkSoft, fontSize: 12, lineHeight: 1.6 }}
          >
            {hint}
          </p>
        </div>

        {/* Tabs -------------------------------------------------------- */}
        <div className="relative" style={{ height: 0 }}>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={open ? "Details ausblenden" : "Details einblenden"}
            className="absolute left-1/2 flex h-6 w-10 items-center justify-center transition"
            style={{ top: 6, transform: "translate(-50%, -50%)", background: "transparent", color: T.inkMuted, opacity: 0.45, zIndex: 10 }}
          >
            <svg
              width={11}
              height={11}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s ease" }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>

        <div
          style={{
            overflow: "hidden",
            maxHeight: open ? 40 : 0,
            opacity: open ? 1 : 0,
            marginTop: open ? 12 : 0,
            transition: "max-height .25s ease, opacity .2s ease, margin-top .25s ease",
          }}
        >
          <div className="flex justify-center gap-5">
            {[
              ["monat", "Monat"],
              ["jahr", "Jahr"],
              ["einstellungen", "Einstellungen"],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className="pb-1 text-xs transition"
                style={{
                  background: "transparent",
                  color: tab === id ? T.ink : T.inkMuted,
                  fontWeight: tab === id ? 600 : 500,
                  borderBottom: tab === id ? `2px solid ${T.accent}` : "2px solid transparent",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Monat ------------------------------------------------------- */}
        {tab === "monat" && (
          <div className="mt-3 p-3" style={card}>
            <div className="mb-1 grid grid-cols-7 gap-1 text-center" style={{ color: T.inkMuted }}>
              {WD_SHORT.map((w) => (
                <div key={w} className="py-1" style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em" }}>
                  {w}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: leading }).map((_, i) => (
                <div key={`pad-${i}`} />
              ))}
              {days.map((d) => {
                const isToday = d.key === todayKey;
                const base = d.cat
                  ? CAT_STYLE[d.cat]
                  : { background: T.surface, color: T.inkMuted, borderColor: T.line };
                return (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => setSheetKey(d.key)}
                    className="flex min-h-16 flex-col items-start justify-between border p-1.5 text-left transition active:scale-95"
                    style={{
                      ...base,
                      borderStyle: "solid",
                      borderWidth: 1,
                      borderRadius: T.radiusCell,
                      fontWeight: 500,
                      outline: isToday ? `2px solid ${T.accent}` : "none",
                      outlineOffset: isToday ? 1 : 0,
                    }}
                  >
                    <span className="flex w-full items-center justify-between text-xs font-semibold tabular-nums">
                      {d.day}
                      {d.manual && (
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: T.accent, opacity: 0.6 }} />
                      )}
                    </span>
                    <span className="w-full break-words text-xs leading-tight">
                      {d.status ? BY_ID[d.status].short : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {tab === "monat" && (
          <div className="mt-3 p-5" style={card}>
            <BueroTagRechner />
          </div>
        )}

        {/* Jahr -------------------------------------------------------- */}
        {tab === "jahr" && (
          <div className="mt-3 p-5" style={card}>
            <h2
              style={{ color: T.ink, fontFamily: HEAD_STACK, fontWeight: 700, fontSize: 20, letterSpacing: "-0.02em" }}
            >
              Jahresübersicht {cursor.y}
            </h2>

            <div className="relative mt-5 h-44">
              <div
                className="absolute left-0 right-0"
                style={{ bottom: `${target}%`, borderTop: `1px dashed ${T.accent}` }}
              >
                <span className="absolute right-0 -top-4 text-xs font-semibold" style={{ color: T.accent }}>
                  {target} %
                </span>
              </div>
              <div className="flex h-full items-end gap-1">
                {yearStats.rows.map((r) => {
                  const h = r.quote === null ? 0 : r.quote;
                  const good = r.quote !== null && r.quote >= target - 1e-9;
                  return (
                    <button
                      key={r.m}
                      type="button"
                      onClick={() => setCursor((c) => ({ ...c, m: r.m }))}
                      className="group flex h-full flex-1 flex-col justify-end"
                      title={`${MONTHS[r.m]}: ${r.a} / ${r.base}`}
                    >
                      <div
                        className="w-full"
                        style={{
                          height: `${Math.max(2, h)}%`,
                          borderTopLeftRadius: 8,
                          borderTopRightRadius: 8,
                          background:
                            r.quote === null
                              ? T.line
                              : good
                              ? `linear-gradient(180deg, #56A5F5 0%, ${T.accent} 100%)`
                              : "#C7D6E8",
                          opacity: r.future ? 0.4 : 1,
                        }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="mt-1 flex gap-1">
              {MONTHS_SHORT.map((m, i) => (
                <div key={m} className="flex-1 text-center text-xs" style={{ color: T.inkMuted }}>
                  {m[0]}
                  {i === cursor.m ? "" : ""}
                </div>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <div className="p-4" style={tile}>
                <div style={sectionLabel}>Kumuliert bis heute</div>
                <div
                  className="mt-1 text-2xl tabular-nums"
                  style={{ color: T.ink, fontFamily: HEAD_STACK, fontWeight: 700, letterSpacing: "-0.03em" }}
                >
                  {yearStats.istTotal.quote === null ? "–" : `${yearStats.istTotal.quote.toFixed(1)} %`}
                </div>
                <div className="text-xs" style={{ color: T.inkMuted }}>
                  {yearStats.istTotal.a} / {yearStats.istTotal.base} Tage
                </div>
              </div>
              <div className="p-4" style={tile}>
                <div style={sectionLabel}>Prognose Jahresende</div>
                <div
                  className="mt-1 text-2xl tabular-nums"
                  style={{ color: T.ink, fontFamily: HEAD_STACK, fontWeight: 700, letterSpacing: "-0.03em" }}
                >
                  {yearStats.total.quote === null ? "–" : `${yearStats.total.quote.toFixed(1)} %`}
                </div>
                <div className="text-xs" style={{ color: T.inkMuted }}>
                  {yearStats.total.a} / {yearStats.total.base} Tage
                </div>
              </div>
            </div>
            <p className="mt-3 text-xs" style={{ color: T.inkMuted }}>
              Jahresquote = Summe A geteilt durch Summe A+B über alle Monate, nicht der Durchschnitt der Monatsquoten.
            </p>

            <div className="mt-5">
              {yearStats.rows.map((r) => (
                <div
                  key={r.m}
                  className="flex items-center justify-between py-2.5 text-sm"
                  style={{ borderBottom: `1px solid ${T.line}` }}
                >
                  <span style={{ color: T.inkSoft, fontWeight: 500 }}>{MONTHS[r.m]}</span>
                  <span className="tabular-nums" style={{ color: T.inkMuted }}>
                    {r.a} / {r.base}
                    <span
                      className="ml-3 font-semibold"
                      style={{
                        color: r.quote === null ? T.inkMuted : r.quote >= target ? T.success : T.ink,
                      }}
                    >
                      {r.quote === null ? "–" : `${Math.floor(r.quote)} %`}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Einstellungen ---------------------------------------------- */}
        {tab === "einstellungen" && (
          <div className="mt-3 space-y-6 p-5" style={card}>
            <div>
              <label htmlFor="ziel" style={sectionLabel}>
                Zielquote
              </label>
              <div className="mt-2 flex items-center gap-3">
                <input
                  id="ziel"
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={target}
                  onChange={(e) => {
                    const v = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                    writeSettings({ ...settings, target: v });
                  }}
                  className="h-12 w-24 px-3 text-lg tabular-nums"
                  style={{
                    background: T.tile,
                    borderRadius: 12,
                    borderStyle: "solid",
                    borderWidth: 1,
                    borderColor: T.line,
                    color: T.ink,
                  }}
                />
                <span style={{ color: T.inkMuted }}>%</span>
              </div>
            </div>

            <div>
              <div style={sectionLabel}>Standardwoche</div>
              <p className="mb-3 mt-1 text-xs" style={{ color: T.inkMuted }}>
                Gilt ab {MONTHS[eff.m]} {eff.y}. Der laufende Monat bleibt unverändert. Feiertage überschreiben die
                Vorbelegung automatisch.
              </p>
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((dow) => {
                  const sel = effWeek[dow];
                  const style = sel
                    ? CAT_STYLE[BY_ID[sel].cat]
                    : { background: T.tile, color: T.inkMuted, borderColor: T.line };
                  return (
                  <div key={dow} className="flex items-center gap-3">
                    <span className="w-8 text-sm font-semibold" style={{ color: T.inkSoft }}>
                      {WD_SHORT[dow - 1]}
                    </span>
                    <select
                      value={sel || ""}
                      onChange={(e) => writeWeekDay(dow, e.target.value || null)}
                      className="h-12 flex-1 border px-3 text-sm"
                      style={{ ...style, borderStyle: "solid", borderWidth: 1, borderRadius: 12, fontWeight: 500 }}
                    >
                      <option value="">— leer —</option>
                      {[...CAT_A, ...CAT_B].map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label} ({s.cat})
                        </option>
                      ))}
                    </select>
                  </div>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={exportCsv}
              className="min-h-11 w-full text-xs"
              style={{
                background: "transparent",
                color: T.inkMuted,
                borderRadius: 999,
                borderStyle: "solid",
                borderWidth: 1,
                borderColor: T.line,
                fontWeight: 500,
              }}
            >
              CSV {cursor.y} exportieren
            </button>

            <KontoBlock email={email} />
          </div>
        )}
      </div>

      <DaySheet
        day={sheetDay}
        defaultStatus={sheetDefault}
        onPick={(status) => {
          writeDay(sheetDay.key, status);
          setSheetKey(null);
        }}
        onReset={() => {
          writeDay(sheetDay.key, null);
          setSheetKey(null);
        }}
        onClose={() => setSheetKey(null)}
      />

      {csvText !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Schließen"
            onClick={() => setCsvText(null)}
            className="absolute inset-0"
            style={{ background: "rgba(15,27,45,0.35)" }}
          />
          <div className="relative w-full max-w-md p-5" style={{ ...card, boxShadow: T.shadowLift }}>
            <div
              className="mb-2 text-sm"
              style={{ color: T.ink, fontFamily: HEAD_STACK, fontWeight: 600 }}
            >
              Download nicht möglich – Text kopieren
            </div>
            <textarea
              readOnly
              value={csvText}
              className="h-64 w-full p-3 text-xs"
              style={{
                background: T.tile,
                borderRadius: 12,
                borderStyle: "solid",
                borderWidth: 1,
                borderColor: T.line,
                color: T.ink,
              }}
            />
            <button
              type="button"
              onClick={() => setCsvText(null)}
              className="mt-3 min-h-12 w-full text-sm"
              style={{ background: T.ink, color: "#FFFFFF", borderRadius: 999, fontWeight: 600 }}
            >
              Schließen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Einstieg: Session prüfen, Daten laden, dann App zeigen              */
/* ------------------------------------------------------------------ */

export default function Root() {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);
  const [needsPassword, setNeedsPassword] = useState(!!window.BQ_INVITE);
  const [profile, setProfile] = useState(null); // null = noch nicht geladen, {} = noch keins vorhanden
  const [dataReady, setDataReady] = useState(false);
  const [dataError, setDataError] = useState(null);

  useEffect(() => {
    let alive = true;
    window.SB.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      setChecking(false);
    });
    const { data: sub } = window.SB.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "PASSWORD_RECOVERY") setNeedsPassword(true);
      if (event === "SIGNED_OUT") {
        setNeedsPassword(false);
        setDataReady(false);
        setProfile(null);
      }
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session || needsPassword || profile) return;
    let alive = true;
    window.SB.from("profiles")
      .select("username, is_admin")
      .eq("user_id", session.user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) setDataError(error.message);
        else setProfile(data || { username: null, is_admin: false });
      });
    return () => {
      alive = false;
    };
  }, [session, needsPassword, profile]);

  useEffect(() => {
    if (!session || needsPassword || dataReady) return;
    if (!profile || !profile.username || profile.is_admin) return;
    let alive = true;
    window.BQStore.init(session.user.id)
      .then(() => {
        if (alive) setDataReady(true);
      })
      .catch((err) => {
        if (alive) setDataError(err.message || String(err));
      });
    return () => {
      alive = false;
    };
  }, [session, needsPassword, dataReady, profile]);

  const spinner = (
    <div className="flex min-h-screen items-center justify-center" style={{ background: T.bg }}>
      <div
        className="h-8 w-8 animate-spin rounded-full"
        style={{ border: `2px solid ${T.line}`, borderTopColor: T.accent }}
      />
    </div>
  );

  if (checking) return spinner;
  if (!session) return <AuthScreen />;
  if (needsPassword) return <SetPasswordScreen onDone={() => setNeedsPassword(false)} />;
  if (dataError)
    return (
      <Shell title="Fehler">
        <Msg tone="error">{"Die Daten konnten nicht geladen werden: " + dataError}</Msg>
        <button
          type="button"
          onClick={() => window.SB.auth.signOut()}
          className="min-h-12 w-full text-sm"
          style={ghostBtnBase}
        >
          Abmelden
        </button>
      </Shell>
    );
  if (!profile) return spinner;
  if (!profile.username)
    return <UsernameScreen onDone={(username) => setProfile({ username, is_admin: false })} />;
  if (profile.is_admin)
    return (
      <AdminView
        onSignOut={() => {
          window.BQStore.reset();
          window.SB.auth.signOut();
        }}
      />
    );
  if (!dataReady) return spinner;
  return <BueroQuote email={profile.username} key={session.user.id} />;
}
