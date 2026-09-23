# Büroquote

Tracker für die Büroanwesenheitsquote. Eine einzelne HTML-Datei, gehostet auf GitHub Pages, Daten in Supabase.

## Funktionen

| Bereich | Beschreibung |
|---|---|
| Kalender | Monatsansicht, Wochenstart Montag, Hamburger Feiertage automatisch |
| Standardwoche | Einmal hinterlegt, belegt alle Tage vor; Änderungen gelten ab dem Folgemonat |
| Quote | Summe A geteilt durch Summe A+B, Ziel 60 %, in den Einstellungen änderbar |
| Bürotag-Rechner | Rechnet in beide Richtungen: Bürozeit → maximale mobile Zeit oder umgekehrt |
| Jahresübersicht | Balken je Monat, kumulierte Jahresquote, CSV-Export |
| Admin | Tabelle aller Mitarbeiter mit Monats- und Jahresquote, rot unter 60 %, grün ab 60 % |

## Kategorien

- **A – zählt als Anwesenheit:** Büro, Berufsschule, Dienstreise, Seminar, sonstige dienstliche Abwesenheit
- **B – zählt zur Basis, nicht zum Zähler:** mobiles Arbeiten
- **C – fällt aus der Quote:** Samstagsarbeit, Urlaub, Krankheit, sonstige Abwesenheit, Feiertage

Die Basis sind ausschließlich die erfassten A- und B-Tage, nicht die Kalenderarbeitstage.

## Aufbau

```
index.html              fertige App, React und Tailwind per CDN
supabase-setup.sql      Schema, Policies und Funktionen
src/buero-quote.jsx     Quelldatei; index.html wird daraus kompiliert
```

## Einrichtung

1. `supabase-setup.sql` im Supabase-SQL-Editor ausführen.
2. In `index.html` die beiden Zeilen unter `SUPABASE-KONFIGURATION` auf das eigene Projekt setzen.
3. In Supabase unter Authentication die Selbstregistrierung deaktivieren und die Site URL auf die GitHub-Pages-Adresse setzen.
4. Nutzer über Authentication → Users → Invite user einladen.
5. Nach dem ersten Login Admin ernennen:
   ```sql
   update public.profiles set is_admin = true where lower(username) = lower('NAME');
   ```

## Änderungen am Code

`src/buero-quote.jsx` bearbeiten und neu kompilieren:

```bash
npx esbuild src/buero-quote.jsx --loader:.jsx=jsx --format=iife --target=es2018 --outfile=app.js
```

Den Inhalt von `app.js` in den letzten `<script>`-Block von `index.html` einsetzen.

## Sicherheit

Der publishable Key in `index.html` ist zur Veröffentlichung bestimmt. Die Absicherung erfolgt über Row Level Security: Jeder sieht ausschließlich seine eigene Zeile, der Admin zusätzlich alle Anwesenheitsdaten, aber keine E-Mail-Adressen. Die Admin-Rolle lässt sich nicht über die App setzen, ein Trigger verhindert das.
