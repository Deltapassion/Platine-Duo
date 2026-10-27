/*
 * Gemini GMX - Mixxx MIDI mapping
 *
 * Original mapping: Miss
 * "Full options" update: hot cues, loops, pad modes (hot cue / auto loop /
 * sampler / FX), shift layer, sync lock, pitch range, auto cue, vinyl/CD jog
 * mode, loop point adjustment with the jog, LED feedback.
 *
 * The HID mapping does more (LCD, VU meters): use it if you can.
 */

var GeminiGMX = {};

/* ------------------------------------------------------------------------ */
/* User options                                                              */
/* ------------------------------------------------------------------------ */

GeminiGMX.Config = {
	JogIntervalsPerRev: 128,
	JogRpm: 33.3333333,
	JogScratchAlpha: 0.125,
	JogScratchBeta: 0.125 / 32.0,
	SearchMultiplier: 8,
	VinylModeAtStartup: true,
	AutoCueAtStartup: false,
	// Crossfader assignment forced at startup (0 = left, 1 = center, 2 = right)
	ForceOrientation: true,
	OrientationAtStartup: [0, 2],
	PitchRanges: [0.06, 0.08, 0.10, 0.16, 0.24, 0.50, 1.00],
	LoopSizes: [0.125, 0.25, 0.5, 1, 2, 4, 8, 16],
	SamplerOffset: [0, 0],
	LoopAdjustStep: 0.002,
	BlinkInterval: 250,
};

/* ------------------------------------------------------------------------ */
/* MIDI note numbers (channel 1 = deck A, channel 2 = deck B)                 */
/* ------------------------------------------------------------------------ */

GeminiGMX.Note = {
	Play: 1,
	Cue: 2,
	LoopIn: 3,
	LoopOut: 4,
	ReloopExit: 5,
	PadMode: 6,
	LoopDouble: 7,
	LoopHalf: 8,
	BpmTap: 17,
	SyncLock: 18,
	KeyLock: 19,
	Range: 20,
	Time: 21,
	Text: 22,
	AutoCue: 23,
	Repeat: 24,
	Search: 26,
	JogTouch: 27,
	BrowseSelect: 28,
	BrowseBack: 29,
	Scratch: 32,
	Reverse: 33,
	Headphones: 34,
	Shift: 43,
};

// Pad notes, pads 1 to 8
GeminiGMX.PadNotes = [9, 10, 11, 12, 35, 36, 37, 38];
GeminiGMX.ShiftPadNotes = [13, 14, 15, 16, 39, 40, 41, 42];

GeminiGMX.PadMode = { HotCue: 0, AutoLoop: 1, Sampler: 2, Fx: 3 };
GeminiGMX.LoopAdjust = { None: 0, In: 1, Out: 2 };

/* ------------------------------------------------------------------------ */
/* Helpers                                                                   */
/* ------------------------------------------------------------------------ */

GeminiGMX.group = function(deck) {
	return "[Channel" + deck + "]";
};

GeminiGMX.fxUnitGroup = function(deck) {
	return "[EffectRack1_EffectUnit" + deck + "]";
};

GeminiGMX.fxGroup = function(deck, effect) {
	return "[EffectRack1_EffectUnit" + deck + "_Effect" + effect + "]";
};

GeminiGMX.samplerGroup = function(deck, pad) {
	return "[Sampler" + (GeminiGMX.Config.SamplerOffset[deck - 1] + pad) + "]";
};

// Toggles a Mixxx control, ignoring the press if the control was changed less
// than 150 ms ago (e.g. by the HID mapping enabled at the same time), so one
// press never toggles twice.
GeminiGMX.Watch = {};
GeminiGMX.watch = function(group, key) {
	var id = group + key;
	if (!GeminiGMX.Watch[id]) {
		GeminiGMX.Watch[id] = { t: 0 };
		engine.makeConnection(group, key, function() {
			GeminiGMX.Watch[id].t = Date.now();
		});
	}
	return GeminiGMX.Watch[id];
};

GeminiGMX.toggle = function(group, key) {
	var w = GeminiGMX.watch(group, key);
	if (Date.now() - w.t < 150) {
		return;
	}
	engine.setValue(group, key, engine.getValue(group, key) ? 0 : 1);
	w.t = Date.now();
};

GeminiGMX.isShift = function() {
	return GeminiGMX.Shift[0] || GeminiGMX.Shift[1];
};

GeminiGMX.led = function(deck, note, on) {
	var key = deck + ":" + note;
	var value = on ? 0x7F : 0x00;
	if (GeminiGMX.LedCache[key] === value) {
		return;
	}
	GeminiGMX.LedCache[key] = value;
	midi.sendShortMsg(0x90 + deck - 1, note, value);
};

/* ------------------------------------------------------------------------ */
/* Init / shutdown                                                           */
/* ------------------------------------------------------------------------ */

GeminiGMX.Reset = function() {
	// Turn all LEDs off
	for (var c = 0; c < 2; c++) {
		for (var i = 1; i <= 43; i++) {
			midi.sendShortMsg(0x90 + c, i, 0);
		}
	}
	GeminiGMX.LedCache = {};
};

GeminiGMX.init = function(id, debugging) {
	var cfg = GeminiGMX.Config;
	var i;

	GeminiGMX.Shift = [false, false];
	GeminiGMX.ButtonState = {};
	GeminiGMX.IsSearching = [false, false];
	GeminiGMX.VinylMode = [cfg.VinylModeAtStartup, cfg.VinylModeAtStartup];
	GeminiGMX.PadModeState = [GeminiGMX.PadMode.HotCue, GeminiGMX.PadMode.HotCue];
	GeminiGMX.LoopAdjustState = [GeminiGMX.LoopAdjust.None, GeminiGMX.LoopAdjust.None];
	GeminiGMX.AutoCue = cfg.AutoCueAtStartup;
	GeminiGMX.BlinkOn = false;

	GeminiGMX.Reset();

	if (cfg.ForceOrientation) {
		engine.setValue("[Channel1]", "orientation", cfg.OrientationAtStartup[0]);
		engine.setValue("[Channel2]", "orientation", cfg.OrientationAtStartup[1]);
	}

	var update = GeminiGMX.updateLeds;
	for (var deck = 1; deck <= 2; deck++) {
		var group = GeminiGMX.group(deck);
		var keys = [
			"play_indicator", "cue_indicator", "keylock", "reverse", "pfl", "repeat",
			"loop_enabled", "loop_start_position", "loop_end_position", "sync_enabled",
		];
		for (i = 0; i < keys.length; i++) {
			engine.makeConnection(group, keys[i], update);
		}
		for (i = 1; i <= 8; i++) {
			engine.makeConnection(group, "hotcue_" + i + "_enabled", update);
		}
		for (i = 0; i < cfg.LoopSizes.length; i++) {
			engine.makeConnection(group, "beatloop_" + cfg.LoopSizes[i] + "_enabled", update);
		}
		for (i = 1; i <= 3; i++) {
			engine.makeConnection(GeminiGMX.fxGroup(deck, i), "enabled", update);
		}
		engine.makeConnection(GeminiGMX.fxUnitGroup(deck), "enabled", update);
		engine.makeConnection(GeminiGMX.fxUnitGroup(deck), "group_" + group + "_enable", update);
	}

	var lastSampler = Math.max(cfg.SamplerOffset[0], cfg.SamplerOffset[1]) + 8;
	for (i = 1; i <= lastSampler; i++) {
		engine.makeConnection("[Sampler" + i + "]", "track_loaded", update);
		engine.makeConnection("[Sampler" + i + "]", "play_indicator", update);
	}

	var watched = ["play", "pfl", "keylock", "reverse", "repeat", "sync_enabled", "quantize"];
	for (i = 0; i < watched.length; i++) {
		GeminiGMX.watch("[Channel1]", watched[i]);
		GeminiGMX.watch("[Channel2]", watched[i]);
	}

	GeminiGMX.BlinkTimer = engine.beginTimer(cfg.BlinkInterval, function() {
		GeminiGMX.BlinkOn = !GeminiGMX.BlinkOn;
		GeminiGMX.updateLeds();
	});

	GeminiGMX.updateLeds();
};

GeminiGMX.shutdown = function() {
	if (GeminiGMX.BlinkTimer) {
		engine.stopTimer(GeminiGMX.BlinkTimer);
		GeminiGMX.BlinkTimer = 0;
	}
	GeminiGMX.Reset();
};

/* ------------------------------------------------------------------------ */
/* LEDs                                                                      */
/* ------------------------------------------------------------------------ */

GeminiGMX.padLed = function(deck, pad) {
	var group = GeminiGMX.group(deck);
	var mode = GeminiGMX.PadModeState[deck - 1];
	var M = GeminiGMX.PadMode;

	if (mode === M.HotCue) {
		return engine.getValue(group, "hotcue_" + pad + "_enabled") > 0;
	}
	if (mode === M.AutoLoop) {
		return engine.getValue(group, "beatloop_" + GeminiGMX.Config.LoopSizes[pad - 1] + "_enabled") > 0;
	}
	if (mode === M.Sampler) {
		var sampler = GeminiGMX.samplerGroup(deck, pad);
		if (engine.getValue(sampler, "play_indicator")) {
			return GeminiGMX.BlinkOn;
		}
		return engine.getValue(sampler, "track_loaded") > 0;
	}
	if (pad >= 1 && pad <= 3) {
		return engine.getValue(GeminiGMX.fxGroup(deck, pad), "enabled") > 0;
	}
	if (pad === 4) {
		return engine.getValue(GeminiGMX.fxUnitGroup(deck), "group_" + group + "_enable") > 0;
	}
	if (pad === 8) {
		return engine.getValue(GeminiGMX.fxUnitGroup(deck), "enabled") > 0;
	}
	return false;
};

GeminiGMX.updateLeds = function() {
	var N = GeminiGMX.Note;
	var blink = GeminiGMX.BlinkOn;

	for (var deck = 1; deck <= 2; deck++) {
		var group = GeminiGMX.group(deck);
		var idx = deck - 1;

		GeminiGMX.led(deck, N.Play, engine.getValue(group, "play_indicator"));
		GeminiGMX.led(deck, N.Cue, engine.getValue(group, "cue_indicator"));
		GeminiGMX.led(deck, N.KeyLock, engine.getValue(group, "keylock"));
		GeminiGMX.led(deck, N.Reverse, engine.getValue(group, "reverse"));
		GeminiGMX.led(deck, N.Headphones, engine.getValue(group, "pfl"));
		GeminiGMX.led(deck, N.Repeat, engine.getValue(group, "repeat"));
		GeminiGMX.led(deck, N.AutoCue, GeminiGMX.AutoCue);
		GeminiGMX.led(deck, N.Search, GeminiGMX.IsSearching[idx]);
		GeminiGMX.led(deck, N.Scratch, GeminiGMX.VinylMode[idx]);

		var loopEnabled = engine.getValue(group, "loop_enabled") > 0;
		var loopIn = loopEnabled || engine.getValue(group, "loop_start_position") >= 0;
		var loopOut = loopEnabled || engine.getValue(group, "loop_end_position") >= 0;
		if (GeminiGMX.LoopAdjustState[idx] === GeminiGMX.LoopAdjust.In) { loopIn = blink; }
		if (GeminiGMX.LoopAdjustState[idx] === GeminiGMX.LoopAdjust.Out) { loopOut = blink; }
		GeminiGMX.led(deck, N.LoopIn, loopIn);
		GeminiGMX.led(deck, N.LoopOut, loopOut);

		var mode = GeminiGMX.PadModeState[idx];
		var modeLed = (mode === GeminiGMX.PadMode.AutoLoop) ||
			(mode !== GeminiGMX.PadMode.HotCue && blink);
		GeminiGMX.led(deck, N.PadMode, modeLed);

		for (var pad = 1; pad <= 8; pad++) {
			GeminiGMX.led(deck, GeminiGMX.PadNotes[pad - 1], GeminiGMX.padLed(deck, pad));
		}
	}
};

/* ------------------------------------------------------------------------ */
/* Buttons                                                                   */
/* ------------------------------------------------------------------------ */

// Every button of the deck is routed here (see the XML file)
GeminiGMX.Button = function(channel, control, value, status, group) {
	var deck = channel + 1;
	// A release can come as "note off" (0x8n) with any velocity, or as
	// "note on" (0x9n) with velocity 0: both mean released.
	var pressed = ((status & 0xF0) === 0x90) && value > 0;
	var N = GeminiGMX.Note;

	var g = GeminiGMX.group(deck);
	var shift = GeminiGMX.isShift();
	var i;

	// Pads
	for (i = 0; i < 8; i++) {
		if (control === GeminiGMX.PadNotes[i]) {
			GeminiGMX.handlePad(deck, i + 1, pressed, false);
			return;
		}
		if (control === GeminiGMX.ShiftPadNotes[i]) {
			GeminiGMX.handlePad(deck, i + 1, pressed, true);
			return;
		}
	}

	switch (control) {
	case N.Shift:
		GeminiGMX.Shift[deck - 1] = pressed;
		return;

	case N.Play:
		if (pressed) { GeminiGMX.toggle(g, "play"); }
		return;

	case N.Cue:
		engine.setValue(g, "cue_default", pressed ? 1 : 0);
		return;

	case N.LoopIn:
		GeminiGMX.loopPointButton(deck, pressed, "loop_in", GeminiGMX.LoopAdjust.In);
		return;

	case N.LoopOut:
		GeminiGMX.loopPointButton(deck, pressed, "loop_out", GeminiGMX.LoopAdjust.Out);
		return;

	case N.ReloopExit:
		if (pressed) {
			GeminiGMX.LoopAdjustState[deck - 1] = GeminiGMX.LoopAdjust.None;
			engine.setValue(g, "reloop_toggle", 1);
		}
		return;

	case N.LoopDouble:
		if (pressed) { engine.setValue(g, "loop_double", 1); }
		return;

	case N.LoopHalf:
		if (pressed) { engine.setValue(g, "loop_halve", 1); }
		return;

	case N.PadMode:
		if (pressed) { GeminiGMX.switchPadMode(deck); }
		return;

	case N.BpmTap:
		if (pressed) {
			engine.setValue(g, engine.getValue(g, "play") ? "bpm_tap" : "beats_translate_curpos", 1);
		}
		return;

	case N.SyncLock:
		if (pressed) { GeminiGMX.toggle(g, "sync_enabled"); }
		return;

	case N.KeyLock:
		if (pressed) { GeminiGMX.toggle(g, "keylock"); }
		return;

	case N.Range:
		if (pressed) { GeminiGMX.nextRange(deck); }
		return;

	case N.Time:
		if (pressed) {
			// 0 = elapsed, 1 = remaining (Mixxx skin display)
			var remaining = engine.getValue("[Controls]", "ShowDurationRemaining");
			engine.setValue("[Controls]", "ShowDurationRemaining", remaining === 1 ? 0 : 1);
		}
		return;

	case N.Text:
		if (pressed) { GeminiGMX.toggle(g, "quantize"); }
		return;

	case N.AutoCue:
		if (pressed) {
			GeminiGMX.AutoCue = !GeminiGMX.AutoCue;
			GeminiGMX.updateLeds();
		}
		return;

	case N.Repeat:
		if (pressed) { GeminiGMX.toggle(g, "repeat"); }
		return;

	case N.Search:
		if (pressed) {
			GeminiGMX.IsSearching[deck - 1] = !GeminiGMX.IsSearching[deck - 1];
			GeminiGMX.updateLeds();
		}
		return;

	case N.Scratch:
		if (pressed) {
			GeminiGMX.VinylMode[deck - 1] = !GeminiGMX.VinylMode[deck - 1];
			if (!GeminiGMX.VinylMode[deck - 1] && engine.isScratching(deck)) {
				engine.scratchDisable(deck, true);
			}
			GeminiGMX.updateLeds();
		}
		return;

	case N.Reverse:
		if (shift) {
			engine.setValue(g, "reverseroll", pressed ? 1 : 0);
		} else if (pressed) {
			GeminiGMX.toggle(g, "reverse");
		}
		return;

	case N.Headphones:
		if (pressed) { GeminiGMX.toggle(g, "pfl"); }
		return;

	case N.JogTouch:
		GeminiGMX.JogTouch(deck, pressed);
		return;

	case N.BrowseSelect:
		if (!pressed) { return; }
		// [Library] focused_widget (Mixxx 2.4+): 2 = sidebar
		if (engine.getValue("[Library]", "focused_widget") === 2) {
			engine.setValue("[Library]", "GoToItem", 1);
			return;
		}
		engine.setValue(g, "LoadSelectedTrack", 1);
		if (GeminiGMX.AutoCue) {
			engine.setValue(g, "pfl", 1);
			engine.setValue(GeminiGMX.group(deck === 1 ? 2 : 1), "pfl", 0);
		}
		return;

	case N.BrowseBack:
		if (pressed) {
			engine.setValue("[Library]", "MoveFocusForward", 1);
		}
		return;
	}
};

GeminiGMX.nextRange = function(deck) {
	var g = GeminiGMX.group(deck);
	var ranges = GeminiGMX.Config.PitchRanges;
	var current = engine.getValue(g, "rateRange");
	var next = ranges[0];
	for (var i = 0; i < ranges.length; i++) {
		if (ranges[i] > current + 0.001) {
			next = ranges[i];
			break;
		}
	}
	engine.setValue(g, "rateRange", next);
};

/* ------------------------------------------------------------------------ */
/* Loops                                                                     */
/* ------------------------------------------------------------------------ */

GeminiGMX.loopPointButton = function(deck, pressed, key, adjustMode) {
	var g = GeminiGMX.group(deck);
	var idx = deck - 1;

	if (!pressed) {
		engine.setValue(g, key, 0);
		return;
	}
	if (engine.getValue(g, "loop_enabled")) {
		GeminiGMX.LoopAdjustState[idx] =
			(GeminiGMX.LoopAdjustState[idx] === adjustMode) ? GeminiGMX.LoopAdjust.None : adjustMode;
		GeminiGMX.updateLeds();
		return;
	}
	GeminiGMX.LoopAdjustState[idx] = GeminiGMX.LoopAdjust.None;
	engine.setValue(g, key, 1);
};

GeminiGMX.adjustLoop = function(deck, delta) {
	var g = GeminiGMX.group(deck);
	var adjust = GeminiGMX.LoopAdjustState[deck - 1];

	if (!engine.getValue(g, "loop_enabled")) {
		GeminiGMX.LoopAdjustState[deck - 1] = GeminiGMX.LoopAdjust.None;
		return false;
	}

	var sampleRate = engine.getValue(g, "track_samplerate") || 44100;
	var step = Math.round(sampleRate * GeminiGMX.Config.LoopAdjustStep) * 2;
	var start = engine.getValue(g, "loop_start_position");
	var end = engine.getValue(g, "loop_end_position");
	var minLength = step * 4;

	if (adjust === GeminiGMX.LoopAdjust.In) {
		var newStart = start + delta * step;
		if (newStart < 0) { newStart = 0; }
		if (newStart > end - minLength) { newStart = end - minLength; }
		engine.setValue(g, "loop_start_position", newStart);
	} else {
		var newEnd = end + delta * step;
		if (newEnd < start + minLength) { newEnd = start + minLength; }
		engine.setValue(g, "loop_end_position", newEnd);
	}
	return true;
};

/* ------------------------------------------------------------------------ */
/* Pads                                                                      */
/* ------------------------------------------------------------------------ */

// PADS MODE: HOT CUE -> AUTO LOOP -> SAMPLER -> FX -> HOT CUE
GeminiGMX.switchPadMode = function(deck) {
	var idx = deck - 1;
	GeminiGMX.PadModeState[idx] = (GeminiGMX.PadModeState[idx] + 1) % 4;
	GeminiGMX.updateLeds();
};

GeminiGMX.handlePad = function(deck, pad, pressed, shift) {
	var g = GeminiGMX.group(deck);
	var M = GeminiGMX.PadMode;
	var mode = GeminiGMX.PadModeState[deck - 1];

	if (mode === M.HotCue) {
		if (shift) {
			if (pressed) { engine.setValue(g, "hotcue_" + pad + "_clear", 1); }
		} else {
			engine.setValue(g, "hotcue_" + pad + "_activate", pressed ? 1 : 0);
		}
		return;
	}

	if (mode === M.AutoLoop) {
		var size = GeminiGMX.Config.LoopSizes[pad - 1];
		if (shift) {
			engine.setValue(g, "beatlooproll_" + size + "_activate", pressed ? 1 : 0);
		} else if (pressed) {
			engine.setValue(g, "beatloop_" + size + "_toggle", 1);
		}
		return;
	}

	if (!pressed) {
		return;
	}

	if (mode === M.Sampler) {
		var sampler = GeminiGMX.samplerGroup(deck, pad);
		if (shift) {
			if (engine.getValue(sampler, "play")) {
				engine.setValue(sampler, "cue_gotoandstop", 1);
			} else {
				engine.setValue(sampler, "eject", 1);
				engine.setValue(sampler, "eject", 0);
			}
		} else if (engine.getValue(sampler, "track_loaded")) {
			engine.setValue(sampler, "cue_gotoandplay", 1);
		} else {
			engine.setValue(sampler, "LoadSelectedTrack", 1);
		}
		return;
	}

	// FX mode
	var unit = GeminiGMX.fxUnitGroup(deck);
	if (pad >= 1 && pad <= 3) {
		var fx = GeminiGMX.fxGroup(deck, pad);
		if (shift) {
			engine.setValue(fx, "next_effect", 1);
		} else {
			GeminiGMX.toggle(fx, "enabled");
		}
	} else if (pad === 4) {
		GeminiGMX.toggle(unit, "group_" + g + "_enable");
	} else if (pad >= 5 && pad <= 7) {
		engine.setValue(GeminiGMX.fxGroup(deck, pad - 4), shift ? "prev_effect" : "next_effect", 1);
	} else if (pad === 8) {
		GeminiGMX.toggle(unit, "enabled");
	}
	GeminiGMX.updateLeds();
};

/* ------------------------------------------------------------------------ */
/* Jog wheels                                                                */
/* ------------------------------------------------------------------------ */

GeminiGMX.JogTouch = function(deck, pressed) {
	var cfg = GeminiGMX.Config;
	if (pressed) {
		if (GeminiGMX.VinylMode[deck - 1] &&
			!GeminiGMX.IsSearching[deck - 1] &&
			GeminiGMX.LoopAdjustState[deck - 1] === GeminiGMX.LoopAdjust.None) {
			engine.scratchEnable(deck, cfg.JogIntervalsPerRev, cfg.JogRpm,
				cfg.JogScratchAlpha, cfg.JogScratchBeta, true);
		}
	} else if (engine.isScratching(deck)) {
		engine.scratchDisable(deck, true);
	}
};

GeminiGMX.JogSpin = function(channel, control, value, status, group) {
	var deck = channel + 1;
	// Relative value, see "Midi Spec.txt": delta = ceil(value - 63.5)
	var delta = Math.ceil(value - 63.5);

	if (delta === 0) {
		return;
	}

	if (GeminiGMX.LoopAdjustState[deck - 1] !== GeminiGMX.LoopAdjust.None) {
		if (GeminiGMX.adjustLoop(deck, delta)) {
			return;
		}
	}

	if (GeminiGMX.IsSearching[deck - 1]) {
		delta *= GeminiGMX.Config.SearchMultiplier;
	}

	if (engine.isScratching(deck)) {
		engine.scratchTick(deck, delta);
	} else {
		engine.setValue(GeminiGMX.group(deck), "jog", delta);
	}
};

/* ------------------------------------------------------------------------ */
/* Library knob                                                              */
/* ------------------------------------------------------------------------ */

GeminiGMX.Browse = function(channel, control, value, status, group) {
	var delta = Math.ceil(value - 63.5);
	if (delta === 0) {
		return;
	}
	engine.setValue("[Library]", GeminiGMX.isShift() ? "ScrollVertical" : "MoveVertical", delta);
};
