# Gemini GMX v2.1 - Mixxx mapping

A [Mixxx](https://www.mixxx.org/) mapping for the [Gemini GMX](https://geminisound.com/products/gmx).

Original mapping and HID protocol reverse engineering by **Miss**. Version 2 keeps the original
transport code (PLAY / CUE behave exactly like the original script) and adds hot cues, auto
loops, loop rolls, sampler and FX pad modes, manual loops with jog adjustment, sync lock, pitch
range, vinyl/CD jog modes, auto cue, VU meter master/cue switch, LCD text and LED feedback.

Requires Mixxx 2.3.0 or newer. Tested against the Mixxx 2.4+ HID output queue.

## What's new in 2.1

* **The LCD time counters work.** The GMX firmware only shows the time when bit 6 of the LCD
  flags byte is set, and it displays *duration minus position* (both in 1/75 s, little endian).
  Version 2 sent the remaining time and the duration with bit 6 off, so the counters stayed at
  00:00:00. TIME switches between remaining and elapsed time.
* LCD text on one line by default (`LcdTextLines: 1` in the `Config` section): pad mode, `Q`
  when quantize is on, `SYNC` when sync is on. Set it to 4 for the previous four-line status.
* The protocol notes in `HID Outgoing Packet.txt` are updated with these findings.

## Installation

1. **Remove every older GMX mapping** from your Mixxx controllers folder
   (Mixxx: *Preferences > Controllers > Open User Mapping Folder*), for example:
   `Gemini GMX.midi.xml`, `Gemini GMX HID.hid.xml`, `Gemini GMX Full HID.hid.xml`,
   `Gemini GMX Full MIDI.midi.xml` and their `.js` files. Otherwise several GMX entries appear
   in the list and it is easy to load the wrong one.
2. Copy `Gemini GMX v2 HID.hid.xml` and `Gemini-GMX-v2-HID.js` into that folder
   (Windows: `%LOCALAPPDATA%\Mixxx\controllers`, macOS: `~/Library/Application Support/Mixxx/controllers`,
   Linux: `~/.mixxx/controllers`).
3. Press and hold the **MIDI** button on the GMX until it lights up, then start Mixxx.
4. *Preferences > Controllers*: the GMX appears twice.
   * **HID** entry: load **Gemini GMX v2.1 (HID)**, tick *Enabled*.
   * **MIDI** entry: "No mapping", *Enabled* unticked.
5. Audio: Master = channels 1-2, Headphones = channels 3-4 of the GMX audio device.

The `MIDI-optionnel` folder contains a MIDI fallback mapping. Only use it if the HID entry is
not available, and never together with the HID mapping. Its mixer CC numbers come from
`Midi Spec.txt` and may not match every unit; it does not drive the LCDs or VU meters.

## Controls

### Transport
| Control | Function |
|---|---|
| PLAY | Play / pause |
| CUE | Cue (Mixxx cue mode, see *Preferences > Decks*) |
| REVERSE | Reverse on/off |
| SCRATCH | Vinyl mode (jog top scratches) / CD mode (jog bends) |
| SEARCH | Jog fast-seek mode |
| REPEAT | Repeat track |
| Headphones | PFL on/off |
| Jog wheel | Scratch (vinyl mode) or pitch bend; fast seek in SEARCH mode |

### Tempo
| Control | Function |
|---|---|
| Pitch fader | Tempo |
| KEY LOCK | Key lock |
| SHIFT + KEY LOCK (RANGE) | Next pitch range: 6, 8, 10, 16, 24, 50, 100 % |
| BPM TAP | Tap tempo while playing; when paused, moves the beatgrid to the current position |
| SHIFT + BPM TAP (LOCK) | Sync lock on/off |

### Loops
| Control | Function |
|---|---|
| LOOP IN | Set loop in. With an active loop: jog adjusts the loop in point (LED blinks), press again to leave |
| LOOP OUT | Set loop out. With an active loop: jog adjusts the loop out point (LED blinks), press again to leave |
| SHIFT + LOOP IN | Loop / 2 |
| SHIFT + LOOP OUT | Loop x 2 |
| RELOOP/EXIT | Exit loop / reloop |

### Pads
**PADS MODE** (hot cue on/off - auto loop) cycles HOT CUE -> AUTO LOOP -> SAMPLER -> FX
(LED off = hot cue, on = auto loop, blinking = sampler / FX). The mode is shown on the LCD.

| Mode | Pad | SHIFT + pad |
|---|---|---|
| HOT CUE | Set / jump to hot cue 1-8 (hold while paused to preview) | Delete hot cue |
| AUTO LOOP | Loop of 1/8, 1/4, 1/2, 1, 2, 4, 8, 16 beats | Loop roll of the same size while held |
| SAMPLER | Play sampler 1-8 from the start; empty sampler = load the selected track | Stop, or eject if stopped |
| FX | 1-3: effect 1-3 on/off, 4: assign effect unit to this deck, 5-7: next effect in slot 1-3, 8: effect unit on/off | 1-3: next effect, 5-7: previous effect |

Deck A uses effect unit 1, deck B effect unit 2.

### Display and library
| Control | Function |
|---|---|
| TIME | Elapsed / remaining time |
| SHIFT + TIME (TEXT) | Quantize on/off |
| AUTO CUE | Auto cue on/off: a loaded track is sent to the headphones |
| BROWSE knob | Move in the list |
| BROWSE push | Track list: load the selected track on the deck. Sidebar: open / expand the item (Mixxx 2.4+) |
| BACK | Switch focus sidebar / track list |
| VU switch CUE/MASTER | VU meters show master, or deck A / deck B levels |

All SHIFT combinations above are sent by the GMX itself. The script never reads the SHIFT
button on its own, so PLAY, CUE and the other buttons can't be affected by it.

The LCDs show elapsed/remaining time, BPM, progress bar, and a status text with the pad mode,
crossfader side, pitch range, quantize and sync state.

## Crossfader

At startup the mapping assigns deck A to the left and deck B to the right of the crossfader
(`ForceOrientation` option). The crossfader curve is set in Mixxx: *Preferences > Mixer*.

## Options

The top of the script has a `Config` section: jog sensitivity, search speed, vinyl mode and
auto cue at startup, pitch ranges, loop sizes, sampler numbering (`SamplerOffset`, e.g. `[0, 8]`
to give deck B samplers 9-16), loop adjust step, blink speed and crossfader assignment.

## Technical notes

* LCD text reports use Mixxx's non-skipping HID queue (Mixxx 2.4+), otherwise they are
  overwritten by the next LED / VU meter report. Text is sent at most every 100 ms.
* Byte 36 of the main report is set to 0x27, as observed in the original packets.
* Toggles (play, PFL, key lock...) ignore a second change within 150 ms, so a press can never
  toggle twice even if the MIDI mapping is enabled by mistake at the same time.

## Known limitations / help wanted

* Pitch percentage and range values on the numeric LCD (the P% encoding is not fully decoded yet).
* The GMX only talks to the computer once its **MIDI** button is lit: press and hold it after
  plugging the controller in, before starting Mixxx.
* Track title / artist on the LCD (Mixxx does not expose track metadata to controller scripts).

Bug reports with a `mixxx --controller-debug` log are very welcome.
