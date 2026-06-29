# Conveyer Ori — Complete Guide

**Turn a written script into a finished, ready-to-upload long-form YouTube video — on your own computer.**

You paste a script. The app automatically:

1. Splits it into scenes.
2. Finds **real video clips and photos** that match what each scene is about.
3. Records **one continuous AI voiceover** of your whole script.
4. Assembles everything into a finished **MP4** video file.

It runs **entirely on your own computer** — there is no website to log into and nothing is uploaded anywhere. Your scripts, settings and videos stay on your machine.

---

## What kind of video it makes (the "two zones")

This tool is built for **long (up to ~1 hour) documentary-style** videos with two parts:

- **🎬 The intro (first ~2–3 minutes): fast and engaging.** The picture changes quickly (about every 5 seconds) and uses a **mix of real video clips and photos** matched to your words — just like the first minutes of the big channels in this niche.
- **🖼️ The body (the rest of the video): slow and calm.** **Photos only**, each with a gentle slow zoom (the "Ken-Burns" effect), changing about every 15 seconds.

You can change where the intro ends, how fast each part moves, and the photo/video mix — all from the **Settings** page (see "[The Two-Zone settings](#the-two-zone-settings)" below). No editing skills needed.

---

## Table of contents

1. [Before you start — what you need](#1-before-you-start--what-you-need)
2. [Installing the app](#2-installing-the-app)
3. [Starting the app](#3-starting-the-app)
4. [First-time setup — entering your keys](#4-first-time-setup--entering-your-keys)
5. [Making your first video](#5-making-your-first-video)
6. [The Two-Zone settings](#the-two-zone-settings)
7. [Where your videos are saved](#6-where-your-videos-are-saved)
8. [Check that everything works (no keys needed)](#7-check-that-everything-works-no-keys-needed)
9. [Updating to a new version](#8-updating-to-a-new-version)
10. [Stopping the app](#9-stopping-the-app)
11. [Troubleshooting](#10-troubleshooting)
12. [Frequently asked questions](#11-frequently-asked-questions)

---

## 1. Before you start — what you need

You need **four** things installed/ready before the app will make videos. Take them one at a time — it's a one-time setup.

### a) A computer
A **Mac** or a **Windows** PC. (The app works the same on both.)

### b) Node.js (version 20 or newer)
This is the engine the app runs on. It's free.

- Go to **https://nodejs.org**
- Download the big green **"LTS"** button.
- Open the downloaded file and click **Next → Next → Install** (accept the defaults).
- That's it. You won't see an app open — Node.js works in the background.

### c) FFmpeg
This is the free tool that actually builds the video file.

- **On a Mac:** the easiest way is with Homebrew. Open the **Terminal** app and paste:
  ```
  brew install ffmpeg
  ```
  (If `brew` isn't installed, get it first from **https://brew.sh** — paste the one line on that page into Terminal.)
- **On Windows:** download a build from **https://www.gyan.dev/ffmpeg/builds/** (the "full" release `ffmpeg-release-full.7z`), unzip it, and either:
  - put the `ffmpeg.exe` file's folder on your system PATH, **or**
  - just note where `ffmpeg.exe` is — you can paste its full path into the app's Settings later (the **FFmpeg path** field).

> 💡 **Tip:** for **on-screen text** (captions/titles) you need an FFmpeg build that includes "libfreetype". The "full" Windows build above has it; on Mac, `brew install ffmpeg` usually has it. If yours doesn't, the video still renders fine — it just skips any on-screen text. (Ori's channels run with text **off** by default, so this won't affect you unless you turn captions on.)

### d) Your API keys
The app uses a few online services to do the smart parts. You paste these keys into the app **once** (in Settings). Each is free or low-cost to start.

| Key | What it's for | Where to get it |
|---|---|---|
| **Google Gemini** | Reads your script & splits it into scenes; checks that footage matches | https://aistudio.google.com/app/apikey |
| **Pexels** | The library of real video clips and photos | https://www.pexels.com/api/ |
| **Groq** | Lines the voiceover up perfectly with the pictures | https://console.groq.com/keys |
| **Voice (GenAIPro)** | The AI voice that reads your script | (your GenAIPro account — key + your Voice ID) |

You don't need all of them to just open and look at the app — but you need them to actually **make a video**.

---

## 2. Installing the app

You'll receive the app as a **folder** (or a ZIP you unzip into a folder). Put it somewhere easy to find, like your Desktop or Documents.

**On a Mac:**
1. Open the app folder in Finder.
2. Double-click **`install.command`**.
3. A black window opens and installs everything (takes a few minutes the first time). When it says **"Done!"**, you can close it.

> If macOS says *"install.command can't be opened because it is from an unidentified developer"*: right-click the file → **Open** → **Open**. You only need to do this once.

**On Windows:**
1. Open the app folder.
2. Double-click **`install.bat`**.
3. A window opens and installs everything. When it says **"Done!"**, close it.

That's the whole installation. You don't reinstall this every time — only once (and again when you update to a new version).

---

## 3. Starting the app

Every time you want to use the app:

- **Mac:** double-click **`start.command`** in the app folder.
- **Windows:** double-click **`start.bat`**.

A window opens and stays open (that's the app running — don't close it while you work). After a few seconds it will say something like *"ready on http://localhost:3000"*.

Now open your web browser (Chrome, Safari, Edge…) and go to:

### 👉 http://localhost:3000

You'll see the Conveyer Ori screen. This is the app — it just runs inside your browser, on your own computer.

---

## 4. First-time setup — entering your keys

1. In the app, click **Settings** (left side).
2. Paste each of your keys into the matching box:
   - **Google API key** (Gemini)
   - **Pexels API key**
   - **Groq API key**
   - Under **Voice Over**, choose your voice engine and paste your **voice key** and **Voice ID**.
3. (Optional) If FFmpeg isn't found automatically, paste the full path to it in **FFmpeg path**.
4. Click **Save all changes** at the top.

You only do this once. Your keys are stored privately on your own computer.

> 🔒 Your keys never leave your machine except to talk directly to those services (Google, Pexels, etc.). Nothing is sent to us.

---

## 5. Making your first video

1. Go to **Video Conveyer** (the main page).
2. (Optional) Type a **Title** so you can find the video later.
3. **Paste your full script** into the big box.
4. Click **Run pipeline**.
5. The page switches to a live progress view. You'll see each step happen: splitting the script, recording the voice, finding footage, assembling the video.
6. When it's done, the finished **video appears right there** to preview, and the file is saved on your computer (see next section).

A long (1-hour) video takes a while to build — that's normal. You can watch the progress log the whole time. You can also leave it running and come back.

> The app does the **intro** (fast, video+photos) and the **body** (slow, photos) automatically, in one continuous voiceover. You don't have to split anything yourself.

---

## The Two-Zone settings

In **Settings → "Two-Zone Timeline (Intro + Body)"** you control the look:

| Setting | What it does | Default |
|---|---|---|
| **Intro length (seconds)** | How long the fast, engaging intro lasts. Everything after this point becomes the slow photo body. **Set it to `0`** to make the whole video slow photos. | `150` (2.5 min) |
| **Intro: seconds per visual** | How often the picture changes during the intro. Lower = snappier. | `5` |
| **Body: seconds per photo** | How often the photo changes during the slow body. | `15` |
| **Intro photo / video mix (%)** | How much of the intro is photos vs. real video clips. `20` means mostly video with a few photos. `0` = all video. | `20` |

Change a value, click **Save all changes**, and your next video uses the new settings.

---

## 6. Where your videos are saved

By default, finished videos and their pieces are saved in a hidden folder in your home directory:

- **Mac:** `~/.conveyer-ori/runs/<your video title>/`
- **Windows:** `C:\Users\<you>\.conveyer-ori\runs\<your video title>\`

The finished file is named **`final.mp4`** inside that folder.

You can choose a different, easier folder: **Settings → Storage → Runs output folder** (e.g. your Desktop). Click Save, and new videos go there.

> Your settings and past videos live in that `.conveyer-ori` folder — **outside** the app folder. That means you can safely replace the app with a new version (see Updating) without losing anything.

---

## 7. Check that everything works (no keys needed)

Want to confirm the app can build video on your computer **before** spending any API credits? With the app running, open this address in your browser:

### 👉 http://localhost:3000/api/smoke

It quickly makes a tiny test video using made-up colours and a tone (no internet, no keys, no cost). If you see **`"ok": true`** with a file size and a duration, your computer's video engine (FFmpeg) is working perfectly. If you see an error, it usually means FFmpeg isn't installed or found — see Troubleshooting.

---

## 8. Updating to a new version

When you receive a new version:

1. **Stop the app** if it's running (see next section).
2. Replace the old app folder with the new one (or, if you use Git: open Terminal/Command Prompt in the folder and run `git pull`).
3. Run the installer again (**`install.command`** on Mac / **`install.bat`** on Windows) — this updates the parts that changed.
4. Start the app as usual.

**Your settings, keys and past videos are safe** — they live in the `.conveyer-ori` folder, not in the app folder, so replacing the app never touches them.

---

## 9. Stopping the app

- Close the black **start** window (or press **Ctrl + C** inside it).
- Or double-click **`stop.command`** (Mac) / **`stop.bat`** (Windows).

The browser tab can stay open — it just won't do anything until you start the app again.

---

## 10. Troubleshooting

**"The page won't open / can't reach localhost"**
The app isn't running. Double-click `start.command` (Mac) or `start.bat` (Windows) and wait for "ready", then refresh the browser.

**"/api/smoke" shows an error, or a video fails with an FFmpeg message**
FFmpeg isn't installed or the app can't find it. Install it (see step 1c), or paste its full path into **Settings → FFmpeg path** and Save.

**A run stops with "GOOGLE_API_KEY is not set" (or PEXELS / GROQ)**
That key is missing. Open **Settings**, paste the key, and **Save all changes**.

**The voice doesn't work / wrong voice**
Check **Settings → Voice Over**: the voice engine, the voice **key**, and the **Voice ID** must all be filled in. Make sure you typed the Voice ID exactly.

**On-screen text isn't appearing**
On-screen text is **off by default**. If you turned it on and it still doesn't show, your FFmpeg build is missing "libfreetype" — install a "full" FFmpeg build (see step 1c). The video still renders without text.

**Footage looks a bit off-topic sometimes**
Stock footage is never perfect. Add a short hint in **Settings → Video context** (e.g. "WWII-era firearms, historical photos") to keep results on-theme.

**It's slow on a long video**
That's expected — a 1-hour video has hundreds of pieces to fetch and assemble. Watch the live log; you can leave it running.

**macOS won't open install.command ("unidentified developer")**
Right-click the file → **Open** → **Open**. One time only.

---

## 11. Frequently asked questions

**Does this upload my video to YouTube?**
No. It creates the **`final.mp4`** file on your computer. You upload it to YouTube yourself.

**Is my script or data sent to you?**
No. Everything runs locally. Your keys only talk directly to the services they belong to (Google, Pexels, Groq, your voice provider).

**Can I make a normal (not 1-hour) video?**
Yes — paste any length of script. For a short video, set the **Intro length** small (or `0`).

**Can I make an all-photos slideshow with no video clips?**
Yes — set **Intro length (seconds)** to `0`. The whole video becomes slow photos with Ken-Burns.

**Do I need to keep the black window open?**
Yes, while you're using the app. It's the app itself running. Closing it stops the app.

---

*Conveyer Ori runs locally — Next.js + FFmpeg, no cloud, no account. Your machine, your data.*
