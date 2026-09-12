<p align="center">
  <img src="resources/logo.png" alt="Easy Clip" width="128">
</p>

<h1 align="center">Easy Clip</h1>

Speichere Clips in beliebiger Länge über einen Hotkey.

Easy Clip spricht mit [OBS Studio](https://obsproject.com/), speichert den Wiederholungspuffer und schneidet ihn in deiner gewünschten Länge zu.

<p align="center">
  <img src="docs/library.png" alt="Easy-Clip-Bibliothek mit Clip-Miniaturansichten, Titeln und verbundenem OBS" width="800">
</p>

---

## Was du brauchst

- Windows 10 oder 11
- [OBS Studio](https://obsproject.com/) 28 oder neuer
- Easy Clip Installationsdatei

---

## Easy Clip installieren

1. Öffne die Seite [GitHub Releases](https://github.com/Trebossalol/easy-clip/releases).
2. Lade **`EasyClip-Setup-….exe`** herunter. Es gibt auch eine portable **`EasyClip-Portable-….exe`** Version.
3. Starte das Installationsprogramm und durchlaufe die Installation.
4. Starte **Easy Clip** über das Startmenü oder die Desktopverknüpfung.

Das Schließen des Fensters **beendet die App nicht** — sie bleibt im Windows-Traymenü (unten rechts). Klicke auf das Easy Clip Symbol, um das Easy Clip Fenster wieder zu öffnen. Zum vollständigen Beenden klicke mit der rechten Maustaste auf das Symbol im Traymenü und wähle **Beenden**.

Das Symbol zeigt ein rotes Abzeichen mit der Anzahl der Clips an, die noch nicht mit einem Titel versehen wurden.

---

## Ersteinrichtung

Diese Einrichtung ist einmalig erforderlich. 

### 1. OBS-WebSocket aktivieren

1. Öffne **OBS Studio**.
2. Gehe zu **Werkzeuge → WebSocket-Server-Einstellungen**.
3. Aktiviere **WebSocket-Server aktivieren**.
4. Lass den Port bei **4455**, außer du weißt, dass du etwas anderes brauchst.
5. Aktiviere **Authentifizierung aktivieren**, wähle ein Passwort und speichere.
6. Öffne in Easy Clip **Einstellungen → OBS**.
7. Füge dasselbe Passwort unter **Passwort** ein und klicke auf **Einstellungen speichern**.

<p align="center">
  <img src="docs/settings-obs.png" alt="Easy-Clip-OBS-Einstellungen: WebSocket-URL, Passwort, Clip-Szene und Dauer des Wiederholungspuffers" width="800">
</p>

Die Server-URL (`ws://localhost:4455`) ist für eine normale OBS-Installation bereits richtig.

### 2. Beide Apps auf denselben Ordner zeigen

Clips werden standardmäßig unter `C:\Clips` gespeichert, sortiert in `YYYY\MM`-Ordner.

1. Öffne in Easy Clip **Einstellungen → Speicher**.
2. Wähle einen **Clip-Ausgabeordner** (oder behalte `C:\Clips`).
3. In OBS: **Datei → Einstellungen → Ausgabe → Aufnahme**.
4. Setze den **Aufnahmepfad** auf **denselben Ordner**.
5. Wenn der Ausgabemodus **Erweitert** ist, steht der Pfad auf dem Tab **Aufnahme**.

### 3. Wiederholungspuffer einschalten

Easy Clip speichert den Puffer — es erfindet kein Material, das OBS nicht aufgenommen hat.

1. In OBS: **Datei → Einstellungen → Ausgabe**.
2. Wenn du den Tab Wiederholungspuffer brauchst, setze den Ausgabemodus auf **Erweitert**.
3. Öffne **Wiederholungspuffer**.
4. Aktiviere **Wiederholungspuffer**.
5. Stelle die **maximale Wiederholungszeit** in Easy Clip unter **Einstellungen → OBS → Aufnahme** ein, oder direkt in OBS. Easy Clip schreibt den Wert beim Speichern nach OBS.
6. Klicke auf **Übernehmen** / **OK**, falls du es in OBS geändert hast.

Du kannst OBS aus Easy Clip starten: Klicke auf die Statusanzeige in der oberen Leiste (**OBS starten**). Das startet OBS, wechselt zur Clip-Szene (falls eingestellt), übernimmt die Pufferdauer und startet den Wiederholungspuffer.

### 4. Optional: Autostart

In der **installierten** App öffne **Einstellungen → Autostart** und schalte **Automatischer Start** ein. Easy Clip startet dann mit Windows (im Infobereich) und startet OBS mit dem Wiederholungspuffer.

### 5. Optional aber empfohlen: Clip-Szene

Wenn du eine eigene OBS-Szene für Clips hast, wähle sie unter **Einstellungen → OBS → Aufnahmeszene**. Easy Clip verwendet diese Szene, wenn es OBS startet oder wenn du die Einstellung speicherst. Lass das Feld leer, um die aktuelle OBS-Szene beizubehalten.

---

## So clipst du

OBS muss laufen, verbunden sein (grünes **OBS verbunden**) und der Wiederholungspuffer muss an sein. Die Standardlängen sind **30s / 1m / 5m / 10m**. Du kannst sie unter **Einstellungen → Presets** ändern.

### Aus der App

Die Buttons oben in der Bibliothek speichern die letzten *N* Sekunden.

### Schnellmenü (empfohlen für Hotkeys)

Das ist das kleine Overlay, das über deinem Spiel erscheint.

<p align="center">
  <img src="docs/quick-menu.png" alt="Schnellmenü-Overlay: optionales Titelfeld und Buttons für die Cliplänge" width="480">
</p>

1. Öffne **Einstellungen → Presets**.
2. Klicke in das Feld für die **Schnellmenü**-Verknüpfung und drücke eine Kombination aus **Strg**, **Alt** oder **Windows** plus einer Taste (zum Beispiel `Ctrl+Shift+C`).
3. Speichere die Einstellungen.

<p align="center">
  <img src="docs/settings-presets.png" alt="Preset-Längen, Schnellmenü-Verknüpfung und Hotkeys pro Länge" width="800">
</p>

Wenn du diese Verknüpfung drückst:

- Tippe optional einen Titel.
- Wähle optional Tags (oder lege ein neues an).
- Wähle eine Länge mit der Maus, den Pfeiltasten oder **1–6**.
- **Enter** speichert die markierte Länge. **Esc** oder ein Klick außerhalb schließt das Menü.

Wenn Easy Clip im Hintergrund läuft (Spiel im Vordergrund), erscheint kurz eine Bestätigung über dem Spiel — ohne den Fokus zu stehlen.

### Direkter Hotkey pro Länge

Auf derselben Presets-Seite kann jede Länge eine eigene Verknüpfung haben. Dann wird sofort geclippt — ohne Menü.

Wenn Windows sagt, dass eine Verknüpfung bereits vergeben ist, wähle eine andere Kombination.

---

## Bibliothek

**Bibliothek** ist deine Clipliste:

<p align="center">
  <img src="docs/library.png" alt="Clip-Bibliothek mit Miniaturansichten, Filtern und Clip-Aktionen" width="800">
</p>

- Miniaturansichten; klicke auf einen Clip, um ihn abzuspielen
- Bearbeite den Titel, um die Datei auf der Festplatte umzubenennen
- Suche nach Titel oder Tag
- Filtere nach **alle**, **ohne Titel** oder **letzte 24 Stunden**
- Im Explorer anzeigen, den Cutter öffnen oder löschen (verschiebt die Datei in den Papierkorb)

Neue Videodateien, die im Ausgabeordner landen (`mp4`, `mkv`, `mov`, `webm`, `m4v`), werden automatisch importiert und nach `YYYY\MM` verschoben, falls sie noch nicht dort liegen.

---

## Clip-Cutter

**Schneiden** öffnet ein neues Fenster mit dem integrierten Video Cutter.

<p align="center">
  <img src="docs/cutter.png" alt="Clip-Cutter mit Videovorschau, Behalten-Bereichen auf der Zeitleiste und Speicheroptionen" width="800">
</p>

### Features

- Clip schneiden (Szenen entfernen)
- Clip Auflösung downscalen
- **Als GIF exportieren** speichert ein GIF (max. 12s, 480p) neben dem Clip
- **Als neuen Clip speichern** schreibt eine neue Datei und lässt das Original unangetastet
- **Original überschreiben** ersetzt das Original

---

## Einstellungen (deutsche Bezeichnungen)

| Menü | Was es macht |
|---|---|
| **OBS** | WebSocket-Server, optionaler Pfad zu `obs64.exe`, Clip-Szene und Dauer des Wiederholungspuffers |
| **Speicher** | Ausgabeordner und wie viel Speicherplatz Clips belegen |
| **Presets** | Cliplängen, Schnellmenü-Verknüpfung, Hotkeys pro Länge |
| **Autostart** | Startet Easy Clip und OBS mit dem Wiederholungspuffer bei der Windows-Anmeldung. Funktioniert nur in der installierten (paketierten) App. |
| **Über** | Autor und GitHub-Link |

---

## Fehlerbehebung

| Was du siehst | Was du versuchen kannst |
|---|---|
| **OBS getrennt** / keine Verbindung | OBS ist geschlossen, WebSocket ist aus, oder Passwort/Port stimmen nicht. Prüfe **Extras → WebSocket-Server-Einstellungen** und Easy Clip → **OBS**. |
| **Puffer aus** | Starte den Wiederholungspuffer in OBS oder nutze **OBS starten** in der Statusanzeige von Easy Clip. |
| Preset-Button ausgegraut / „länger als der OBS-Puffer“ | Erhöhe **Wiederholungspuffer** unter **Einstellungen → OBS** oder kürze das Preset. |
| „Falsche OBS-Szene“ | Starte OBS aus Easy Clip, damit zur Clip-Szene gewechselt wird, oder leere die Szeneneinstellung. |
| Schnellmenü / Hotkey tut nichts | Easy Clip muss laufen (Infobereich reicht). Die Verknüpfung braucht Strg, Alt oder Windows plus eine Taste und darf nicht schon von Windows oder einer anderen App belegt sein. |
| OBS startet nicht aus der App | Easy Clip sucht `obs64.exe` unter `C:\Program Files\obs-studio\…`. Liegt deine Installation woanders, setze **OBS-Programmdatei** unter **Einstellungen → OBS**. |
| Clips landen am falschen Ort | Der Ausgabeordner von Easy Clip und der Aufnahmepfad von OBS müssen identisch sein. Easy Clip warnt bei Abweichung und bietet **Clip-Ordner an OBS anpassen**. |

Protokolle (falls du sie brauchst): `%APPDATA%\EasyClip\logs`.

---

## Für Entwickler

```powershell
git clone https://github.com/Trebossalol/easy-clip.git EasyClip
cd EasyClip
npm install
npm run dev
```

Paketierter Build (`dist/EasyClip-Setup-….exe` und die portable EXE):

```powershell
npm run dist
```

Aus dem Quellcode brauchst du [Node.js](https://nodejs.org/) 18+. `npm install` holt FFmpeg; die paketierte App bündelt es unter `resources/ffmpeg/`.
