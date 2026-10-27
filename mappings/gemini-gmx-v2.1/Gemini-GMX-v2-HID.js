/*
 * Gemini GMX - Mixxx HID mapping
 *
 * Original mapping and HID protocol reverse engineering: Miss
 * "Full options" update: hot cues, loops, pad modes (hot cue / auto loop /
 * sampler / FX), shift layer, sync lock, pitch range, auto cue, vinyl/CD jog
 * mode, loop point adjustment with the jog, VU meter master/cue switch,
 * LCD status text and LED feedback.
 *
 * Version 2.1: the LCD time counters work. The firmware only shows the time
 * when bit 6 of the LCD flags byte is set, and it displays (field 2 - field 1):
 * the script now sends the play position in field 1 and the track duration in
 * field 2 (1/75 s units, little endian). See "HID Outgoing Packet.txt".
 * Found with the Platine Duo diagnostic tools, October 2026.
 *
 * Requires Mixxx 2.3.0 or newer.
 */

var GeminiGMXHid = {};

/* ------------------------------------------------------------------------ */
/* User options                                                              */
/* ------------------------------------------------------------------------ */

GeminiGMXHid.Config = {
	// Jog wheel scratch settings
	JogIntervalsPerRev: 128,
	JogRpm: 33.3333333,
	JogScratchAlpha: 0.125,
	JogScratchBeta: 0.125 / 32.0,

	// Jog multiplier while SEARCH mode is on or while SHIFT is held
	SearchMultiplier: 8,

	// Vinyl (scratch) mode enabled at startup for both decks
	VinylModeAtStartup: true,

	// Auto cue enabled at startup: loading a track sends it to the headphones
	AutoCueAtStartup: false,

	// Crossfader assignment forced at startup: deck A left, deck B right.
	// Without this, decks set to the same side are both faded by the crossfader.
	// (0 = left, 1 = center / not affected, 2 = right). Set to false to keep
	// the orientation saved in Mixxx.
	ForceOrientation: true,
	OrientationAtStartup: [0, 2],

	// Pitch ranges cycled by SHIFT + KEY LOCK (RANGE)
	PitchRanges: [0.06, 0.08, 0.10, 0.16, 0.24, 0.50, 1.00],

	// Auto loop pad sizes (in beats), pads 1 to 8
	LoopSizes: [0.125, 0.25, 0.5, 1, 2, 4, 8, 16],

	// Sampler mode: first sampler used by pad 1 of deck A / deck B.
	// 0 means pad 1 = [Sampler1]. With 16 samplers in Mixxx you can set
	// [0, 8] so that deck B uses samplers 9 to 16.
	SamplerOffset: [0, 0],

	// Loop adjust step for the jog wheel, in seconds per jog tick
	LoopAdjustStep: 0.002,

	// Blink period for blinking LEDs, in milliseconds
	BlinkInterval: 250,

	// Lines of text on each LCD: 1 = pad mode, Q (quantize) and SYNC on one line,
	// 4 = pad mode, pitch range, quantize and sync on four lines.
	LcdTextLines: 1,
};

/* ------------------------------------------------------------------------ */
/* Constants                                                                 */
/* ------------------------------------------------------------------------ */

GeminiGMXHid.PadMode = {
	HotCue: 0,
	AutoLoop: 1,
	Sampler: 2,
	Fx: 3,
};

GeminiGMXHid.PadModeNames = ["HOT CUE", "AUTO LOOP", "SAMPLER", "FX"];

GeminiGMXHid.LoopAdjust = {
	None: 0,
	In: 1,
	Out: 2,
};

// BUGFIX: On the Gemini GMX, both jogwheels share the same value internally, but only change when
//         they are spun. For example, let's say deck A and B both are initialized to value 0. As
//         soon as you spin deck A from 0 to 50 the values will be 50 for A and 0 for B. But when
//         you now spin deck B forwards the same rotation, it'll be at value 100 rather than the
//         expected 50. The value is updated correctly as it spins, but they share the same internal
//         value.
//
//         To work around this, we keep track of the last shared value and use this for the delta,
//         rather than trusting the previous data we're storing.
GeminiGMXHid._LastWheelValue = 0;

/* ------------------------------------------------------------------------ */
/* Helpers                                                                   */
/* ------------------------------------------------------------------------ */

GeminiGMXHid.readUint16 = function(data, offset) {
	var b1 = data[offset];
	var b2 = data[offset + 1];
	return (b2 << 8 | b1);
};

GeminiGMXHid.writeInt32 = function(buffer, offset, value) {
	value = Math.round(value);
	buffer[offset] = value & 0xFF;
	buffer[offset + 1] = (value >> 8) & 0xFF;
	buffer[offset + 2] = (value >> 16) & 0xFF;
	buffer[offset + 3] = (value >> 24) & 0xFF;
};

GeminiGMXHid.group = function(deck) {
	return "[Channel" + deck + "]";
};

GeminiGMXHid.fxUnitGroup = function(deck) {
	return "[EffectRack1_EffectUnit" + deck + "]";
};

GeminiGMXHid.fxGroup = function(deck, effect) {
	return "[EffectRack1_EffectUnit" + deck + "_Effect" + effect + "]";
};

GeminiGMXHid.samplerGroup = function(deck, pad) {
	return "[Sampler" + (GeminiGMXHid.Config.SamplerOffset[deck - 1] + pad) + "]";
};

// Toggles a Mixxx control. If the same control was changed less than 150 ms
// ago (for example by the MIDI mapping of the GMX enabled at the same time),
// the press is ignored, so one press never toggles twice (play then pause).
GeminiGMXHid.Watch = {};
GeminiGMXHid.watch = function(group, key) {
	var id = group + key;
	if (!GeminiGMXHid.Watch[id]) {
		GeminiGMXHid.Watch[id] = { t: 0 };
		engine.makeConnection(group, key, function() {
			GeminiGMXHid.Watch[id].t = Date.now();
		});
	}
	return GeminiGMXHid.Watch[id];
};

GeminiGMXHid.toggle = function(group, key) {
	var w = GeminiGMXHid.watch(group, key);
	if (Date.now() - w.t < 150) {
		return;
	}
	engine.setValue(group, key, engine.getValue(group, key) ? 0 : 1);
	w.t = Date.now();
};

// Sends one HID report. LCD text uses Mixxx's non-skipping queue so that it
// can't be overwritten by the next LED / VU meter report (Mixxx 2.4+).
GeminiGMXHid.sendReport = function(buf, nonSkipping) {
	if (nonSkipping) {
		try {
			controller.send(buf, buf.length, 0, true);
			return;
		} catch (e) {
			// Mixxx 2.3: no 4th argument, fall through
		}
	}
	controller.send(buf, buf.length, 0);
};

GeminiGMXHid.padText = function(text, length) {
	var ret = [];
	for (var i = 0; i < length; i++) {
		var c = (i < text.length) ? text.charCodeAt(i) : 0x20;
		if (isNaN(c) || c < 0x20 || c > 0x7E) {
			c = 0x20;
		}
		ret.push(c);
	}
	return ret;
};

/* ------------------------------------------------------------------------ */
/* Init / shutdown                                                           */
/* ------------------------------------------------------------------------ */

GeminiGMXHid.init = function(id, debugging) {
	var i;

	GeminiGMXHid.prevData = null;

	// Per deck state, index 0 = deck A, index 1 = deck B
	GeminiGMXHid.IsSearching = [false, false];
	GeminiGMXHid.VinylMode = [GeminiGMXHid.Config.VinylModeAtStartup, GeminiGMXHid.Config.VinylModeAtStartup];
	GeminiGMXHid.ShowRemainingTime = [true, true];
	GeminiGMXHid.PadModeState = [GeminiGMXHid.PadMode.HotCue, GeminiGMXHid.PadMode.HotCue];
	GeminiGMXHid.LoopAdjustState = [GeminiGMXHid.LoopAdjust.None, GeminiGMXHid.LoopAdjust.None];
	GeminiGMXHid.PendingText = [null, null];
	GeminiGMXHid.LastTextKey = ["", ""];
	GeminiGMXHid.NextTextDeck = 0;
	GeminiGMXHid.AutoCue = GeminiGMXHid.Config.AutoCueAtStartup;

	// VU meter source: true = master, false = cue (deck levels)
	GeminiGMXHid.VuShowsMaster = true;

	GeminiGMXHid.BlinkOn = false;

	GeminiGMXHid.UpdateBuffer = [];
	GeminiGMXHid.LastSentBuffer = [];
	for (i = 0; i < 64; i++) {
		GeminiGMXHid.UpdateBuffer.push(0);
		GeminiGMXHid.LastSentBuffer.push(-1);
	}

	GeminiGMXHid.TextBuffer = [];
	for (i = 0; i < 64; i++) {
		GeminiGMXHid.TextBuffer.push(0);
	}

	if (GeminiGMXHid.Config.ForceOrientation) {
		engine.setValue("[Channel1]", "orientation", GeminiGMXHid.Config.OrientationAtStartup[0]);
		engine.setValue("[Channel2]", "orientation", GeminiGMXHid.Config.OrientationAtStartup[1]);
	}

	GeminiGMXHid.update();
	GeminiGMXHid.refreshText(1);
	GeminiGMXHid.refreshText(2);
	GeminiGMXHid.setUpdateCallbacks();

	// Watch the toggled controls from the start (see GeminiGMXHid.toggle)
	var watched = ["play", "pfl", "keylock", "reverse", "repeat", "sync_enabled", "quantize"];
	for (i = 0; i < watched.length; i++) {
		GeminiGMXHid.watch("[Channel1]", watched[i]);
		GeminiGMXHid.watch("[Channel2]", watched[i]);
	}

	// LCD text is sent from this timer only: at most one text report every
	// 100 ms, so the controller is never flooded
	GeminiGMXHid.TextTimer = engine.beginTimer(100, GeminiGMXHid.flushText);

	GeminiGMXHid.BlinkTimer = engine.beginTimer(GeminiGMXHid.Config.BlinkInterval, function() {
		GeminiGMXHid.BlinkOn = !GeminiGMXHid.BlinkOn;
		GeminiGMXHid.update();
	});
};

GeminiGMXHid.shutdown = function() {
	if (GeminiGMXHid.BlinkTimer) {
		engine.stopTimer(GeminiGMXHid.BlinkTimer);
		GeminiGMXHid.BlinkTimer = 0;
	}
	if (GeminiGMXHid.TextTimer) {
		engine.stopTimer(GeminiGMXHid.TextTimer);
		GeminiGMXHid.TextTimer = 0;
	}

	for (var i = 0; i < 63; i++) {
		GeminiGMXHid.UpdateBuffer[i] = 0;
	}
	GeminiGMXHid.UpdateBuffer[63] = 0;
	GeminiGMXHid.sendReport(GeminiGMXHid.UpdateBuffer, true);

	GeminiGMXHid.updateText(1, "Mixxx");
	GeminiGMXHid.updateText(2, "Mixxx");
};

GeminiGMXHid.setUpdateCallbacks = function() {
	var update = GeminiGMXHid.update;
	var i;

	engine.makeConnection("[Master]", "VuMeterL", update);
	engine.makeConnection("[Master]", "VuMeterR", update);

	for (var deck = 1; deck <= 2; deck++) {
		var group = GeminiGMXHid.group(deck);

		var keys = [
			"beat_active", "cue_indicator", "play_indicator", "pfl", "keylock",
			"reverse", "repeat", "visual_bpm", "playposition", "duration",
			"track_loaded", "loop_enabled", "loop_start_position",
			"loop_end_position", "VuMeter",
		];
		for (i = 0; i < keys.length; i++) {
			engine.makeConnection(group, keys[i], update);
		}

		for (i = 1; i <= 8; i++) {
			engine.makeConnection(group, "hotcue_" + i + "_enabled", update);
		}

		for (i = 0; i < GeminiGMXHid.Config.LoopSizes.length; i++) {
			engine.makeConnection(group, "beatloop_" + GeminiGMXHid.Config.LoopSizes[i] + "_enabled", update);
		}

		for (i = 1; i <= 3; i++) {
			engine.makeConnection(GeminiGMXHid.fxGroup(deck, i), "enabled", update);
		}
		engine.makeConnection(GeminiGMXHid.fxUnitGroup(deck), "enabled", update);
		engine.makeConnection(GeminiGMXHid.fxUnitGroup(deck), "group_" + group + "_enable", update);

		// LCD status text
		var refresh = (function(d) {
			return function() { GeminiGMXHid.refreshText(d); };
		})(deck);
		engine.makeConnection(group, "sync_enabled", refresh);
		engine.makeConnection(group, "quantize", refresh);
		engine.makeConnection(group, "rateRange", refresh);
		engine.makeConnection(group, "orientation", refresh);
	}

	var lastSampler = Math.max(GeminiGMXHid.Config.SamplerOffset[0], GeminiGMXHid.Config.SamplerOffset[1]) + 8;
	for (i = 1; i <= lastSampler; i++) {
		engine.makeConnection("[Sampler" + i + "]", "track_loaded", update);
		engine.makeConnection("[Sampler" + i + "]", "play_indicator", update);
	}
};

/* ------------------------------------------------------------------------ */
/* Output: LEDs, VU meters and LCD                                           */
/* ------------------------------------------------------------------------ */

GeminiGMXHid.padLed = function(deck, pad) {
	var group = GeminiGMXHid.group(deck);
	var mode = GeminiGMXHid.PadModeState[deck - 1];

	if (mode === GeminiGMXHid.PadMode.HotCue) {
		return engine.getValue(group, "hotcue_" + pad + "_enabled") > 0;
	}

	if (mode === GeminiGMXHid.PadMode.AutoLoop) {
		return engine.getValue(group, "beatloop_" + GeminiGMXHid.Config.LoopSizes[pad - 1] + "_enabled") > 0;
	}

	if (mode === GeminiGMXHid.PadMode.Sampler) {
		var sampler = GeminiGMXHid.samplerGroup(deck, pad);
		if (engine.getValue(sampler, "play_indicator")) {
			return GeminiGMXHid.BlinkOn;
		}
		return engine.getValue(sampler, "track_loaded") > 0;
	}

	// FX mode
	if (pad >= 1 && pad <= 3) {
		return engine.getValue(GeminiGMXHid.fxGroup(deck, pad), "enabled") > 0;
	}
	if (pad === 4) {
		return engine.getValue(GeminiGMXHid.fxUnitGroup(deck), "group_" + group + "_enable") > 0;
	}
	if (pad === 8) {
		return engine.getValue(GeminiGMXHid.fxUnitGroup(deck), "enabled") > 0;
	}
	return false;
};

GeminiGMXHid.updateDeckLeds = function(deck) {
	var group = GeminiGMXHid.group(deck);
	var buf = GeminiGMXHid.UpdateBuffer;
	var idx = deck - 1;
	var blink = GeminiGMXHid.BlinkOn;

	var offset = (deck === 1) ? 1 : 4;

	var b0 = 0;
	var b1 = 0;
	var b2 = 0;

	// Byte 0
	if (GeminiGMXHid.IsSearching[idx]) { b0 |= (1 << 0); }
	if (GeminiGMXHid.VinylMode[idx]) { b0 |= (1 << 1); }
	if (engine.getValue(group, "beat_active")) { b0 |= (1 << 2); }

	var mode = GeminiGMXHid.PadModeState[idx];
	if (mode === GeminiGMXHid.PadMode.AutoLoop) {
		b0 |= (1 << 3);
	} else if (mode !== GeminiGMXHid.PadMode.HotCue && blink) {
		// Sampler and FX modes: blinking PADS MODE LED
		b0 |= (1 << 3);
	}

	var loopEnabled = engine.getValue(group, "loop_enabled") > 0;
	var loopStart = engine.getValue(group, "loop_start_position");
	var loopEnd = engine.getValue(group, "loop_end_position");
	var adjust = GeminiGMXHid.LoopAdjustState[idx];

	var loopOutLed = loopEnabled || loopEnd >= 0;
	var loopInLed = loopEnabled || loopStart >= 0;
	if (adjust === GeminiGMXHid.LoopAdjust.Out) { loopOutLed = blink; }
	if (adjust === GeminiGMXHid.LoopAdjust.In) { loopInLed = blink; }
	if (loopOutLed) { b0 |= (1 << 4); }
	if (loopInLed) { b0 |= (1 << 5); }

	if (engine.getValue(group, "cue_indicator")) { b0 |= (1 << 6); }
	if (engine.getValue(group, "play_indicator")) { b0 |= (1 << 7); }

	// Byte 1: pads
	for (var pad = 1; pad <= 8; pad++) {
		if (GeminiGMXHid.padLed(deck, pad)) {
			b1 |= (1 << (8 - pad));
		}
	}

	// Byte 2
	var loaded = engine.getValue(group, "track_loaded") > 0;
	if (engine.getValue(group, "repeat")) { b2 |= (1 << 2); }
	if (loaded) { b2 |= (1 << 3); }
	if (GeminiGMXHid.AutoCue) { b2 |= (1 << 4); }
	if (engine.getValue(group, "pfl")) { b2 |= (1 << 5); }
	if (engine.getValue(group, "keylock")) { b2 |= (1 << 6); }
	if (engine.getValue(group, "reverse")) { b2 |= (1 << 7); }

	buf[offset] = b0;
	buf[offset + 1] = b1;
	buf[offset + 2] = b2;

	// LCD numeric display
	var lcdOffset = (deck === 1) ? 9 : 23;
	var flags = 0;
	var i;
	for (i = 1; i <= 12; i++) {
		buf[lcdOffset + i] = 0;
	}

	var bpm = Math.round(engine.getValue(group, "visual_bpm") * 100);
	if (bpm > 0 && bpm <= 0xFFFF) {
		flags |= (1 << 5);
		buf[lcdOffset + 9] = bpm & 0xFF;
		buf[lcdOffset + 10] = (bpm >> 8) & 0xFF;
	}

	var duration = engine.getValue(group, "duration");
	if (loaded && duration > 0) {
		// bit 7: time field present, bit 6: show the time (without it the counter stays at 00:00:00)
		flags |= (1 << 7) | (1 << 6);

		var playPosition = engine.getValue(group, "playposition") * duration;
		if (playPosition < 0) { playPosition = 0; }
		if (playPosition > duration) { playPosition = duration; }
		var timeLeft = duration - playPosition;

		// The LCD shows (field 2 - field 1), in 1/75 s.
		// Remaining time: field 1 = position, field 2 = duration (the progress bar uses the same values).
		// Elapsed time (TIME button): field 1 = 0, field 2 = position.
		// Never send negative values: the firmware then shows garbage.
		if (GeminiGMXHid.ShowRemainingTime[idx]) {
			GeminiGMXHid.writeInt32(buf, lcdOffset + 1, playPosition * 75);
			GeminiGMXHid.writeInt32(buf, lcdOffset + 5, duration * 75);
		} else {
			GeminiGMXHid.writeInt32(buf, lcdOffset + 1, 0);
			GeminiGMXHid.writeInt32(buf, lcdOffset + 5, playPosition * 75);
		}
	}

	buf[lcdOffset] = flags;
};

GeminiGMXHid.update = function() {
	var buf = GeminiGMXHid.UpdateBuffer;

	GeminiGMXHid.updateDeckLeds(1);
	GeminiGMXHid.updateDeckLeds(2);

	// VU meters: master, or each deck level when the switch is on CUE
	if (GeminiGMXHid.VuShowsMaster) {
		buf[7] = Math.round(engine.getValue("[Master]", "VuMeterL") * 8);
		buf[8] = Math.round(engine.getValue("[Master]", "VuMeterR") * 8);
	} else {
		buf[7] = Math.round(engine.getValue("[Channel1]", "VuMeter") * 8);
		buf[8] = Math.round(engine.getValue("[Channel2]", "VuMeter") * 8);
	}

	// Constant observed in the original packets ("HID Outgoing Packet.txt")
	buf[36] = 0x27;
	buf[63] = 0;

	// Only send when something changed, to keep the USB traffic low
	var changed = false;
	for (var i = 0; i < buf.length; i++) {
		if (buf[i] !== GeminiGMXHid.LastSentBuffer[i]) {
			changed = true;
			GeminiGMXHid.LastSentBuffer[i] = buf[i];
		}
	}
	if (changed) {
		GeminiGMXHid.sendReport(buf, false);
	}
};

GeminiGMXHid.updateText = function(deck, title, artist, album, genre) {
	//NOTE: Calling this function will reset the currently shown text type on the LCD.
	//      We also have not accounted for bytes 2, 3, 4, and 5 yet.
	var buf = GeminiGMXHid.TextBuffer;
	var i;

	for (i = 0; i < 64; i++) {
		buf[i] = 0;
	}

	var flags = 0;
	if (title) { flags |= (1 << 6); }
	if (artist) { flags |= (1 << 5); }
	if (album) { flags |= (1 << 4); }
	if (genre) { flags |= (1 << 3); }
	buf[1] = flags;

	var write = function(text, offset, length) {
		if (!text) {
			return;
		}
		var chars = GeminiGMXHid.padText(text, length);
		for (var j = 0; j < length; j++) {
			buf[offset + j] = chars[j];
		}
	};

	write(title, 6, 20);
	write(artist, 26, 12);
	write(album, 38, 12);
	write(genre, 50, 12);

	buf[62] = 0;
	buf[63] = deck;

	GeminiGMXHid.sendReport(buf, true);

	// A non-skipping report clears Mixxx's pending LED/LCD report:
	// make sure the next update() sends it again
	for (i = 0; i < GeminiGMXHid.LastSentBuffer.length; i++) {
		GeminiGMXHid.LastSentBuffer[i] = -1;
	}
};

// Shows the deck status on the LCD text lines
GeminiGMXHid.refreshText = function(deck) {
	var group = GeminiGMXHid.group(deck);
	var idx = deck - 1;

	var range = Math.round(engine.getValue(group, "rateRange") * 100);
	var xf = ["XF:L", "XF:-", "XF:R"][engine.getValue(group, "orientation")] || "";
	var title = (deck === 1 ? "A " : "B ") + GeminiGMXHid.PadModeNames[GeminiGMXHid.PadModeState[idx]] + "  " + xf;
	var artist = "Range " + range + "%";
	var album = "Quant " + (engine.getValue(group, "quantize") ? "ON" : "OFF");
	var genre = "Sync " + (engine.getValue(group, "sync_enabled") ? "ON" : "OFF");

	var lines = [title, artist, album, genre];
	if (GeminiGMXHid.Config.LcdTextLines === 1) {
		var line = (deck === 1 ? "A " : "B ") + GeminiGMXHid.PadModeNames[GeminiGMXHid.PadModeState[idx]] +
			(engine.getValue(group, "quantize") ? " Q" : "") + (engine.getValue(group, "sync_enabled") ? " SYNC" : "");
		lines = [line.substring(0, 20), "", "", ""];
	}
	if (lines.join("|") !== GeminiGMXHid.LastTextKey[idx]) {
		GeminiGMXHid.PendingText[idx] = lines;
	} else {
		GeminiGMXHid.PendingText[idx] = null;
	}
};

// Called by the text timer: sends at most one pending LCD text report
GeminiGMXHid.flushText = function() {
	for (var n = 0; n < 2; n++) {
		var idx = (GeminiGMXHid.NextTextDeck + n) % 2;
		var lines = GeminiGMXHid.PendingText[idx];
		if (lines) {
			GeminiGMXHid.PendingText[idx] = null;
			GeminiGMXHid.LastTextKey[idx] = lines.join("|");
			GeminiGMXHid.NextTextDeck = (idx + 1) % 2;
			GeminiGMXHid.updateText(idx + 1, lines[0], lines[1], lines[2], lines[3]);
			GeminiGMXHid.update();
			return;
		}
	}
};

/* ------------------------------------------------------------------------ */
/* Input parsing                                                             */
/* ------------------------------------------------------------------------ */

GeminiGMXHid.getBit = function(data, offset, bitpos) {
	return !!(data[offset] & (1 << bitpos));
};

GeminiGMXHid.checkBit = function(data, offset, bitpos, onChanged, ud) {
	var now = GeminiGMXHid.getBit(data, offset, bitpos);
	if (!GeminiGMXHid.prevData) {
		// First report: only remember the state, do not trigger anything
		return;
	}

	var prev = GeminiGMXHid.getBit(GeminiGMXHid.prevData, offset, bitpos);
	if (prev !== now) {
		onChanged(prev, now, ud);
	}
};

GeminiGMXHid.checkChanged8 = function(data, offset, onChanged, ud) {
	var now = data[offset];
	if (!GeminiGMXHid.prevData) {
		onChanged(null, now, ud);
		return;
	}

	var prev = GeminiGMXHid.prevData[offset];
	if (prev !== now) {
		onChanged(prev, now, ud);
	}
};

GeminiGMXHid.checkChanged16 = function(data, offset, onChanged, ud) {
	var now = GeminiGMXHid.readUint16(data, offset);
	if (!GeminiGMXHid.prevData) {
		onChanged(null, now, ud);
		return;
	}

	var prev = GeminiGMXHid.readUint16(GeminiGMXHid.prevData, offset);
	if (prev !== now) {
		onChanged(prev, now, ud);
	}
};

GeminiGMXHid.incomingData = function(data, length) {
	var checkDeckButtons = function(offset, bitpos, onChanged, ud) {
		GeminiGMXHid.checkBit(data, offset, bitpos, onChanged, ud ? [1, ud] : 1);
		GeminiGMXHid.checkBit(data, 16 + offset, bitpos, onChanged, ud ? [2, ud] : 2);
	};

	// Note: the SHIFT button itself (byte 5 bit 4) is not used by the script.
	// The GMX sends dedicated bits for its SHIFT combinations (pads, loop x2
	// and /2, lock, range, text), which are handled below.

	// Buttons
	checkDeckButtons(0, 6, GeminiGMXHid.buttonPlay);
	checkDeckButtons(0, 5, GeminiGMXHid.buttonCue);
	checkDeckButtons(0, 4, GeminiGMXHid.buttonLoopIn);
	checkDeckButtons(0, 3, GeminiGMXHid.buttonLoopOut);
	checkDeckButtons(0, 2, GeminiGMXHid.buttonReloopExit);
	checkDeckButtons(0, 1, GeminiGMXHid.buttonPadMode);
	checkDeckButtons(0, 0, GeminiGMXHid.buttonLoopDouble);
	checkDeckButtons(1, 7, GeminiGMXHid.buttonLoopHalf);
	checkDeckButtons(2, 6, GeminiGMXHid.buttonBpmTap);
	checkDeckButtons(2, 5, GeminiGMXHid.buttonSyncLock);
	checkDeckButtons(2, 4, GeminiGMXHid.buttonKeyLock);
	checkDeckButtons(2, 3, GeminiGMXHid.buttonRange);
	checkDeckButtons(2, 2, GeminiGMXHid.buttonTime);
	checkDeckButtons(2, 1, GeminiGMXHid.buttonText);
	checkDeckButtons(2, 0, GeminiGMXHid.buttonAutoCue);
	checkDeckButtons(3, 7, GeminiGMXHid.buttonRepeat);
	checkDeckButtons(3, 5, GeminiGMXHid.buttonSearch);
	checkDeckButtons(3, 4, GeminiGMXHid.buttonJogTouch);
	checkDeckButtons(3, 3, GeminiGMXHid.buttonBrowseSelect);
	checkDeckButtons(3, 2, GeminiGMXHid.buttonBrowseBack);
	checkDeckButtons(4, 7, GeminiGMXHid.buttonScratch);
	checkDeckButtons(4, 6, GeminiGMXHid.buttonReverse);
	checkDeckButtons(4, 5, GeminiGMXHid.buttonHeadphones);

	// Pads 1 through 8
	checkDeckButtons(1, 6, GeminiGMXHid.buttonPad, 1);
	checkDeckButtons(1, 5, GeminiGMXHid.buttonPad, 2);
	checkDeckButtons(1, 4, GeminiGMXHid.buttonPad, 3);
	checkDeckButtons(1, 3, GeminiGMXHid.buttonPad, 4);
	checkDeckButtons(4, 4, GeminiGMXHid.buttonPad, 5);
	checkDeckButtons(4, 3, GeminiGMXHid.buttonPad, 6);
	checkDeckButtons(4, 2, GeminiGMXHid.buttonPad, 7);
	checkDeckButtons(4, 1, GeminiGMXHid.buttonPad, 8);

	// Pads 1 through 8 with shift (sent by the hardware)
	checkDeckButtons(1, 2, GeminiGMXHid.buttonShiftPad, 1);
	checkDeckButtons(1, 1, GeminiGMXHid.buttonShiftPad, 2);
	checkDeckButtons(1, 0, GeminiGMXHid.buttonShiftPad, 3);
	checkDeckButtons(2, 7, GeminiGMXHid.buttonShiftPad, 4);
	checkDeckButtons(4, 0, GeminiGMXHid.buttonShiftPad, 5);
	checkDeckButtons(5, 7, GeminiGMXHid.buttonShiftPad, 6);
	checkDeckButtons(5, 6, GeminiGMXHid.buttonShiftPad, 7);
	checkDeckButtons(5, 5, GeminiGMXHid.buttonShiftPad, 8);

	// Controls
	GeminiGMXHid.checkChanged16(data, 6, GeminiGMXHid.changedMasterVolume);
	GeminiGMXHid.checkChanged16(data, 22, GeminiGMXHid.changedCueVolume);
	GeminiGMXHid.checkChanged16(data, 61, GeminiGMXHid.changedBoothVolume);
	GeminiGMXHid.checkChanged16(data, 54, GeminiGMXHid.changedCueMix);

	GeminiGMXHid.checkChanged16(data, 52, GeminiGMXHid.changedCrossFade);
	GeminiGMXHid.checkChanged16(data, 48, GeminiGMXHid.changedVolume, 1);
	GeminiGMXHid.checkChanged16(data, 50, GeminiGMXHid.changedVolume, 2);

	GeminiGMXHid.checkChanged8(data, 56, GeminiGMXHid.changedCueMaster);

	GeminiGMXHid.checkChanged8(data, 57, GeminiGMXHid.changedBrowse);

	GeminiGMXHid.checkChanged16(data, 8, GeminiGMXHid.changedRate, 1);
	GeminiGMXHid.checkChanged16(data, 24, GeminiGMXHid.changedRate, 2);

	GeminiGMXHid.checkChanged16(data, 14, GeminiGMXHid.changedJog, 1);
	GeminiGMXHid.checkChanged16(data, 30, GeminiGMXHid.changedJog, 2);

	GeminiGMXHid.checkChanged16(data, 32, GeminiGMXHid.changedGain, 1);
	GeminiGMXHid.checkChanged16(data, 34, GeminiGMXHid.changedGain, 2);

	GeminiGMXHid.checkChanged16(data, 40, GeminiGMXHid.changedHighs, 1);
	GeminiGMXHid.checkChanged16(data, 42, GeminiGMXHid.changedHighs, 2);

	GeminiGMXHid.checkChanged16(data, 36, GeminiGMXHid.changedMids, 1);
	GeminiGMXHid.checkChanged16(data, 38, GeminiGMXHid.changedMids, 2);

	GeminiGMXHid.checkChanged16(data, 44, GeminiGMXHid.changedLows, 1);
	GeminiGMXHid.checkChanged16(data, 46, GeminiGMXHid.changedLows, 2);

	GeminiGMXHid.checkChanged16(data, 12, GeminiGMXHid.changedFilter, 1);
	GeminiGMXHid.checkChanged16(data, 28, GeminiGMXHid.changedFilter, 2);

	// Keep a copy: the array given by Mixxx may be reused
	var copy = [];
	for (var i = 0; i < data.length; i++) {
		copy.push(data[i]);
	}
	GeminiGMXHid.prevData = copy;
};

/* ------------------------------------------------------------------------ */
/* Transport                                                                 */
/* ------------------------------------------------------------------------ */

// PLAY: play/pause (never changed by SHIFT, so the transport always works)
GeminiGMXHid.buttonPlay = function(prev, now, deck) {
	if (now) {
		GeminiGMXHid.toggle(GeminiGMXHid.group(deck), "play");
	}
};

// CUE: default Mixxx cue behaviour (never changed by SHIFT)
GeminiGMXHid.buttonCue = function(prev, now, deck) {
	engine.setValue(GeminiGMXHid.group(deck), "cue_default", now ? 1 : 0);
};

// SCRATCH: toggles vinyl (scratch) mode / CD (pitch bend) mode
GeminiGMXHid.buttonScratch = function(prev, now, deck) {
	if (now) {
		GeminiGMXHid.VinylMode[deck - 1] = !GeminiGMXHid.VinylMode[deck - 1];
		if (!GeminiGMXHid.VinylMode[deck - 1] && engine.isScratching(deck)) {
			engine.scratchDisable(deck, true);
		}
		GeminiGMXHid.update();
	}
};

// SEARCH: jog wheel fast seek mode
GeminiGMXHid.buttonSearch = function(prev, now, deck) {
	if (now) {
		GeminiGMXHid.IsSearching[deck - 1] = !GeminiGMXHid.IsSearching[deck - 1];
		GeminiGMXHid.update();
	}
};

// REVERSE: reverse on/off
GeminiGMXHid.buttonReverse = function(prev, now, deck) {
	if (now) {
		GeminiGMXHid.toggle(GeminiGMXHid.group(deck), "reverse");
	}
};

GeminiGMXHid.buttonRepeat = function(prev, now, deck) {
	if (now) {
		GeminiGMXHid.toggle(GeminiGMXHid.group(deck), "repeat");
	}
};

// HEADPHONES: PFL on/off
GeminiGMXHid.buttonHeadphones = function(prev, now, deck) {
	if (now) {
		GeminiGMXHid.toggle(GeminiGMXHid.group(deck), "pfl");
	}
};

/* ------------------------------------------------------------------------ */
/* Tempo                                                                     */
/* ------------------------------------------------------------------------ */

// BPM TAP: tap tempo while playing. When paused, one tap moves the beatgrid
// to the current position.
GeminiGMXHid.buttonBpmTap = function(prev, now, deck) {
	var group = GeminiGMXHid.group(deck);
	if (!now) {
		return;
	}
	if (engine.getValue(group, "play")) {
		engine.setValue(group, "bpm_tap", 1);
	} else {
		engine.setValue(group, "beats_translate_curpos", 1);
	}
};

// LOCK (SHIFT + BPM TAP): sync lock on/off
GeminiGMXHid.buttonSyncLock = function(prev, now, deck) {
	if (now) {
		GeminiGMXHid.toggle(GeminiGMXHid.group(deck), "sync_enabled");
	}
};

GeminiGMXHid.buttonKeyLock = function(prev, now, deck) {
	if (now) {
		GeminiGMXHid.toggle(GeminiGMXHid.group(deck), "keylock");
	}
};

// RANGE (SHIFT + KEY LOCK): next pitch range
GeminiGMXHid.buttonRange = function(prev, now, deck) {
	if (!now) {
		return;
	}
	var group = GeminiGMXHid.group(deck);
	var ranges = GeminiGMXHid.Config.PitchRanges;
	var current = engine.getValue(group, "rateRange");
	var next = ranges[0];
	for (var i = 0; i < ranges.length; i++) {
		if (ranges[i] > current + 0.001) {
			next = ranges[i];
			break;
		}
	}
	engine.setValue(group, "rateRange", next);
	GeminiGMXHid.refreshText(deck);
};

/* ------------------------------------------------------------------------ */
/* Display                                                                   */
/* ------------------------------------------------------------------------ */

// TIME: elapsed / remaining time on the LCD
GeminiGMXHid.buttonTime = function(prev, now, deck) {
	if (now) {
		GeminiGMXHid.ShowRemainingTime[deck - 1] = !GeminiGMXHid.ShowRemainingTime[deck - 1];
		GeminiGMXHid.update();
	}
};

// TEXT (SHIFT + TIME): quantize on/off, shown on the LCD
GeminiGMXHid.buttonText = function(prev, now, deck) {
	if (now) {
		GeminiGMXHid.toggle(GeminiGMXHid.group(deck), "quantize");
		GeminiGMXHid.refreshText(deck);
	}
};

// AUTO CUE: when on, loading a track sends it to the headphones
GeminiGMXHid.buttonAutoCue = function(prev, now, deck) {
	if (now) {
		GeminiGMXHid.AutoCue = !GeminiGMXHid.AutoCue;
		GeminiGMXHid.update();
	}
};

/* ------------------------------------------------------------------------ */
/* Loops                                                                     */
/* ------------------------------------------------------------------------ */

// LOOP IN: sets the loop in point. With an active loop, toggles jog wheel
// adjustment of the loop in point (LED blinks).
GeminiGMXHid.buttonLoopIn = function(prev, now, deck) {
	GeminiGMXHid.loopPointButton(deck, now, "loop_in", GeminiGMXHid.LoopAdjust.In);
};

// LOOP OUT: sets the loop out point. With an active loop, toggles jog wheel
// adjustment of the loop out point (LED blinks).
GeminiGMXHid.buttonLoopOut = function(prev, now, deck) {
	GeminiGMXHid.loopPointButton(deck, now, "loop_out", GeminiGMXHid.LoopAdjust.Out);
};

GeminiGMXHid.loopPointButton = function(deck, now, key, adjustMode) {
	var group = GeminiGMXHid.group(deck);
	var idx = deck - 1;

	if (!now) {
		engine.setValue(group, key, 0);
		return;
	}

	if (engine.getValue(group, "loop_enabled")) {
		GeminiGMXHid.LoopAdjustState[idx] =
			(GeminiGMXHid.LoopAdjustState[idx] === adjustMode) ? GeminiGMXHid.LoopAdjust.None : adjustMode;
		GeminiGMXHid.update();
		return;
	}

	GeminiGMXHid.LoopAdjustState[idx] = GeminiGMXHid.LoopAdjust.None;
	engine.setValue(group, key, 1);
};

// RELOOP/EXIT: exit the loop, or reloop
GeminiGMXHid.buttonReloopExit = function(prev, now, deck) {
	if (!now) {
		return;
	}
	GeminiGMXHid.LoopAdjustState[deck - 1] = GeminiGMXHid.LoopAdjust.None;
	engine.setValue(GeminiGMXHid.group(deck), "reloop_toggle", 1);
};

// LOOP x2 (SHIFT + LOOP OUT)
GeminiGMXHid.buttonLoopDouble = function(prev, now, deck) {
	if (now) {
		engine.setValue(GeminiGMXHid.group(deck), "loop_double", 1);
	}
};

// LOOP /2 (SHIFT + LOOP IN)
GeminiGMXHid.buttonLoopHalf = function(prev, now, deck) {
	if (now) {
		engine.setValue(GeminiGMXHid.group(deck), "loop_halve", 1);
	}
};

// Moves the loop in or out point with the jog wheel
GeminiGMXHid.adjustLoop = function(deck, delta) {
	var group = GeminiGMXHid.group(deck);
	var adjust = GeminiGMXHid.LoopAdjustState[deck - 1];

	if (!engine.getValue(group, "loop_enabled")) {
		GeminiGMXHid.LoopAdjustState[deck - 1] = GeminiGMXHid.LoopAdjust.None;
		return false;
	}

	var sampleRate = engine.getValue(group, "track_samplerate") || 44100;
	// Positions are in interleaved stereo samples, so keep them even
	var step = Math.round(sampleRate * GeminiGMXHid.Config.LoopAdjustStep) * 2;
	var start = engine.getValue(group, "loop_start_position");
	var end = engine.getValue(group, "loop_end_position");
	var minLength = step * 4;

	if (adjust === GeminiGMXHid.LoopAdjust.In) {
		var newStart = start + delta * step;
		if (newStart < 0) { newStart = 0; }
		if (newStart > end - minLength) { newStart = end - minLength; }
		engine.setValue(group, "loop_start_position", newStart);
	} else {
		var newEnd = end + delta * step;
		if (newEnd < start + minLength) { newEnd = start + minLength; }
		engine.setValue(group, "loop_end_position", newEnd);
	}
	return true;
};

/* ------------------------------------------------------------------------ */
/* Pads                                                                      */
/* ------------------------------------------------------------------------ */

// PADS MODE (hot cue on/off - auto loop): cycles
// HOT CUE -> AUTO LOOP -> SAMPLER -> FX -> HOT CUE
// (LED off = hot cue, on = auto loop, blinking = sampler / FX; mode on the LCD)
GeminiGMXHid.buttonPadMode = function(prev, now, deck) {
	if (!now) {
		return;
	}
	var idx = deck - 1;
	GeminiGMXHid.PadModeState[idx] = (GeminiGMXHid.PadModeState[idx] + 1) % 4;

	GeminiGMXHid.update();
	GeminiGMXHid.refreshText(deck);
};

GeminiGMXHid.buttonPad = function(prev, now, ud) {
	GeminiGMXHid.handlePad(ud[0], ud[1], now, false);
};

GeminiGMXHid.buttonShiftPad = function(prev, now, ud) {
	GeminiGMXHid.handlePad(ud[0], ud[1], now, true);
};

GeminiGMXHid.handlePad = function(deck, pad, now, shift) {
	var group = GeminiGMXHid.group(deck);
	var mode = GeminiGMXHid.PadModeState[deck - 1];
	var M = GeminiGMXHid.PadMode;

	if (mode === M.HotCue) {
		if (shift) {
			// SHIFT + pad: delete hot cue
			if (now) {
				engine.setValue(group, "hotcue_" + pad + "_clear", 1);
			}
		} else {
			// Set / jump to hot cue (hold while paused to preview)
			engine.setValue(group, "hotcue_" + pad + "_activate", now ? 1 : 0);
		}
		return;
	}

	if (mode === M.AutoLoop) {
		var size = GeminiGMXHid.Config.LoopSizes[pad - 1];
		if (shift) {
			// SHIFT + pad: loop roll while held
			engine.setValue(group, "beatlooproll_" + size + "_activate", now ? 1 : 0);
		} else if (now) {
			engine.setValue(group, "beatloop_" + size + "_toggle", 1);
		}
		return;
	}

	if (mode === M.Sampler) {
		if (!now) {
			return;
		}
		var sampler = GeminiGMXHid.samplerGroup(deck, pad);
		if (shift) {
			// SHIFT + pad: stop, or eject if already stopped
			if (engine.getValue(sampler, "play")) {
				engine.setValue(sampler, "cue_gotoandstop", 1);
			} else {
				engine.setValue(sampler, "eject", 1);
				engine.setValue(sampler, "eject", 0);
			}
		} else if (engine.getValue(sampler, "track_loaded")) {
			engine.setValue(sampler, "cue_gotoandplay", 1);
		} else {
			// Empty sampler: load the track selected in the library
			engine.setValue(sampler, "LoadSelectedTrack", 1);
		}
		return;
	}

	// FX mode
	if (!now) {
		return;
	}
	var unit = GeminiGMXHid.fxUnitGroup(deck);
	if (pad >= 1 && pad <= 3) {
		var fx = GeminiGMXHid.fxGroup(deck, pad);
		if (shift) {
			engine.setValue(fx, "next_effect", 1);
		} else {
			GeminiGMXHid.toggle(fx, "enabled");
		}
	} else if (pad === 4) {
		// Assign this effect unit to the deck
		GeminiGMXHid.toggle(unit, "group_" + group + "_enable");
	} else if (pad >= 5 && pad <= 7) {
		// Select next (or previous with SHIFT) effect in slot 1 to 3
		engine.setValue(GeminiGMXHid.fxGroup(deck, pad - 4), shift ? "prev_effect" : "next_effect", 1);
	} else if (pad === 8) {
		GeminiGMXHid.toggle(unit, "enabled");
	}
	GeminiGMXHid.update();
};

/* ------------------------------------------------------------------------ */
/* Jog wheels                                                                */
/* ------------------------------------------------------------------------ */

GeminiGMXHid.buttonJogTouch = function(prev, now, deck) {
	if (now) {
		if (GeminiGMXHid.VinylMode[deck - 1] &&
			!GeminiGMXHid.IsSearching[deck - 1] &&
			GeminiGMXHid.LoopAdjustState[deck - 1] === GeminiGMXHid.LoopAdjust.None) {
			var cfg = GeminiGMXHid.Config;
			engine.scratchEnable(deck,
				cfg.JogIntervalsPerRev,
				cfg.JogRpm,
				cfg.JogScratchAlpha,
				cfg.JogScratchBeta,
				true
			);
		}
	} else if (engine.isScratching(deck)) {
		engine.scratchDisable(deck, true);
	}
};

GeminiGMXHid.changedJog = function(prev, now, deck) {
	if (prev === null) {
		GeminiGMXHid._LastWheelValue = now;
		return;
	}

	//BUGFIX: See comment at the very top for more information
	prev = GeminiGMXHid._LastWheelValue;
	GeminiGMXHid._LastWheelValue = now;

	// 0 to 179 (then wraps around)
	var delta = now - prev;
	if (delta < -140) {
		delta = (now + 179 + 1) - prev;
	} else if (delta > 140) {
		delta = (now - 179 - 1) - prev;
	}

	if (delta === 0) {
		return;
	}

	var group = GeminiGMXHid.group(deck);

	// Loop point adjustment
	if (GeminiGMXHid.LoopAdjustState[deck - 1] !== GeminiGMXHid.LoopAdjust.None) {
		if (GeminiGMXHid.adjustLoop(deck, delta)) {
			return;
		}
	}

	// Search mode: fast seek
	if (GeminiGMXHid.IsSearching[deck - 1]) {
		delta *= GeminiGMXHid.Config.SearchMultiplier;
		if (engine.isScratching(deck)) {
			engine.scratchTick(deck, delta);
		} else {
			engine.setValue(group, "jog", delta);
		}
		return;
	}

	if (engine.isScratching(deck)) {
		engine.scratchTick(deck, delta);
	} else {
		// CD mode or outer ring: pitch bend
		engine.setValue(group, "jog", delta);
	}
};

/* ------------------------------------------------------------------------ */
/* Library                                                                   */
/* ------------------------------------------------------------------------ */

// BROWSE push: in the sidebar, open / expand the selected item.
// In the track list, load the selected track on this deck.
GeminiGMXHid.buttonBrowseSelect = function(prev, now, deck) {
	if (!now) {
		return;
	}
	// [Library] focused_widget (Mixxx 2.4+): 2 = sidebar, 3 = track list
	if (engine.getValue("[Library]", "focused_widget") === 2) {
		engine.setValue("[Library]", "GoToItem", 1);
		return;
	}

	var group = GeminiGMXHid.group(deck);
	engine.setValue(group, "LoadSelectedTrack", 1);

	if (GeminiGMXHid.AutoCue) {
		var other = GeminiGMXHid.group(deck === 1 ? 2 : 1);
		engine.setValue(group, "pfl", 1);
		engine.setValue(other, "pfl", 0);
	}
};

// BACK: switch focus between sidebar and track list
GeminiGMXHid.buttonBrowseBack = function(prev, now, deck) {
	if (now) {
		engine.setValue("[Library]", "MoveFocusForward", 1);
	}
};

// BROWSE knob: move in the list
GeminiGMXHid.changedBrowse = function(prev, now) {
	if (prev === null) {
		return;
	}

	// 0 to 29 (then wraps around)
	var delta = now - prev;
	if (delta < -10) {
		delta = (now + 29 + 1) - prev;
	} else if (delta > 10) {
		delta = (now - 29 - 1) - prev;
	}

	engine.setValue("[Library]", "MoveVertical", delta);
};

/* ------------------------------------------------------------------------ */
/* Mixer                                                                     */
/* ------------------------------------------------------------------------ */

GeminiGMXHid.changedMasterVolume = function(prev, now) {
	engine.setParameter("[Master]", "gain", (600 - now) / 600.0);
};

GeminiGMXHid.changedCueVolume = function(prev, now) {
	engine.setParameter("[Master]", "headGain", (600 - now) / 600.0);
};

GeminiGMXHid.changedBoothVolume = function(prev, now) {
	engine.setParameter("[Master]", "booth_gain", (600 - now) / 600.0);
};

GeminiGMXHid.changedCueMix = function(prev, now) {
	engine.setParameter("[Master]", "headMix", (600 - now) / 600.0);
};

GeminiGMXHid.changedCrossFade = function(prev, now) {
	engine.setParameter("[Master]", "crossfader", (800 - now) / 800.0);
};

GeminiGMXHid.changedVolume = function(prev, now, deck) {
	engine.setParameter(GeminiGMXHid.group(deck), "volume", now / 800.0);
};

// VU meter switch: 0 = CUE (shows each deck level), 64 = MASTER
GeminiGMXHid.changedCueMaster = function(prev, now) {
	GeminiGMXHid.VuShowsMaster = (now !== 0);
	GeminiGMXHid.update();
};

GeminiGMXHid.changedRate = function(prev, now, deck) {
	engine.setParameter(GeminiGMXHid.group(deck), "rate", now / 800.0);
};

GeminiGMXHid.changedGain = function(prev, now, deck) {
	engine.setValue(GeminiGMXHid.group(deck), "pregain", script.absoluteNonLin(now, 0, 1.0, 4.0, 0, 600));
};

GeminiGMXHid.changedHighs = function(prev, now, deck) {
	engine.setValue("[EqualizerRack1_[Channel" + deck + "]_Effect1]", "parameter3", script.absoluteNonLin(now, 0, 1.0, 4.0, 0, 600));
};

GeminiGMXHid.changedMids = function(prev, now, deck) {
	engine.setValue("[EqualizerRack1_[Channel" + deck + "]_Effect1]", "parameter2", script.absoluteNonLin(now, 0, 1.0, 4.0, 0, 600));
};

GeminiGMXHid.changedLows = function(prev, now, deck) {
	engine.setValue("[EqualizerRack1_[Channel" + deck + "]_Effect1]", "parameter1", script.absoluteNonLin(now, 0, 1.0, 4.0, 0, 600));
};

GeminiGMXHid.changedFilter = function(prev, now, deck) {
	engine.setParameter("[QuickEffectRack1_[Channel" + deck + "]]", "super1", now / 600.0);
};
