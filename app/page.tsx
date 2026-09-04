"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Clock,
  Timer,
  Play,
  Pause,
  RotateCcw,
  Flag,
  Globe,
  Sun,
  Moon,
  Volume2,
  VolumeX,
  Radio,
  Sliders,
  Maximize2,
  Minimize2,
  Bell,
  Activity,
  Layers,
  Sparkles,
  Zap,
  Flame,
  CheckCircle2
} from "lucide-react";

type Mode = "CLOCK" | "CHRONO" | "INTERVAL" | "METRONOME";

interface WorldZone {
  city: string;
  tz: string;
  code: string;
}

const DEFAULT_ZONES: WorldZone[] = [
  { city: "UTC / GMT", tz: "UTC", code: "UTC" },
  { city: "LONDON", tz: "Europe/London", code: "BST" },
  { city: "NEW YORK", tz: "America/New_York", code: "EDT" },
  { city: "SAN FRANCISCO", tz: "America/Los_Angeles", code: "PDT" },
  { city: "TOKYO", tz: "Asia/Tokyo", code: "JST" },
  { city: "NEW DELHI", tz: "Asia/Kolkata", code: "IST" },
  { city: "SYDNEY", tz: "Australia/Sydney", code: "AEST" },
  { city: "BERLIN", tz: "Europe/Berlin", code: "CEST" },
];

export type ColorSkin = "AMBER" | "MATRIX" | "AVIATION" | "NIGHT_RED";

export const SKIN_CONFIG: Record<ColorSkin, {
  name: string;
  badge: string;
  primaryHex: string;
  accentClass: string;
  borderHover: string;
  textAccent: string;
  bgAccent: string;
}> = {
  AMBER: {
    name: "SWISS AMBER",
    badge: "PRECISION",
    primaryHex: "#ffb703",
    accentClass: "text-amber-500",
    borderHover: "hover:border-amber-500",
    textAccent: "text-amber-400",
    bgAccent: "bg-amber-500",
  },
  MATRIX: {
    name: "RADAR GREEN",
    badge: "CRT PHOSPHOR",
    primaryHex: "#10b981",
    accentClass: "text-emerald-500",
    borderHover: "hover:border-emerald-500",
    textAccent: "text-emerald-400",
    bgAccent: "bg-emerald-500",
  },
  AVIATION: {
    name: "COBALT SKY",
    badge: "AVIONICS",
    primaryHex: "#0284c7",
    accentClass: "text-sky-500",
    borderHover: "hover:border-sky-500",
    textAccent: "text-sky-400",
    bgAccent: "bg-sky-500",
  },
  NIGHT_RED: {
    name: "MILITARY RED",
    badge: "DARKROOM",
    primaryHex: "#ef4444",
    accentClass: "text-rose-500",
    borderHover: "hover:border-rose-500",
    textAccent: "text-rose-400",
    bgAccent: "bg-rose-500",
  },
};

export default function ChronoWatchCockpit() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [skin, setSkin] = useState<ColorSkin>("AMBER");
  const [activeMode, setActiveMode] = useState<Mode>("CLOCK");
  const [now, setNow] = useState<Date | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [is24Hour, setIs24Hour] = useState<boolean>(true);
  const [tzOffsetHours, setTzOffsetHours] = useState<number>(0);

  // Stopwatch state
  const [chronoRunning, setChronoRunning] = useState<boolean>(false);
  const [chronoTimeMs, setChronoTimeMs] = useState<number>(0);
  const [laps, setLaps] = useState<Array<{ lapNumber: number; lapTime: number; overallTime: number }>>([]);
  const chronoRef = useRef<NodeJS.Timeout | null>(null);
  const chronoStartRef = useRef<number>(0);

  // Interval / Focus Timer state
  const [intervalDurationSec, setIntervalDurationSec] = useState<number>(25 * 60);
  const [intervalRemainingSec, setIntervalRemainingSec] = useState<number>(25 * 60);
  const [intervalRunning, setIntervalRunning] = useState<boolean>(false);
  const [intervalPreset, setIntervalPreset] = useState<"POMODORO" | "SHORT_BREAK" | "LONG_BREAK" | "SPRINT">("POMODORO");

  // Metronome state
  const [bpm, setBpm] = useState<number>(120);
  const [beatsPerBar, setBeatsPerBar] = useState<number>(4);
  const [currentBeat, setCurrentBeat] = useState<number>(0);
  const [metronomeRunning, setMetronomeRunning] = useState<boolean>(false);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Fullscreen
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Initialize clock on client mount
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Web Audio Beeper
  const playBeep = (freq: number = 880, duration: number = 0.05) => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") ctx.resume();
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {}
  };

  // Stopwatch Logic
  useEffect(() => {
    if (chronoRunning) {
      const startTime = Date.now() - chronoTimeMs;
      chronoRef.current = setInterval(() => {
        setChronoTimeMs(Date.now() - startTime);
      }, 10);
    } else {
      if (chronoRef.current) clearInterval(chronoRef.current);
    }
    return () => {
      if (chronoRef.current) clearInterval(chronoRef.current);
    };
  }, [chronoRunning]);

  const toggleChrono = () => {
    playBeep(chronoRunning ? 440 : 880);
    setChronoRunning(!chronoRunning);
  };

  const resetChrono = () => {
    playBeep(330);
    setChronoRunning(false);
    setChronoTimeMs(0);
    setLaps([]);
  };

  const recordLap = () => {
    if (!chronoRunning) return;
    playBeep(1200);
    const prevOverall = laps.length > 0 ? laps[0].overallTime : 0;
    const lapTime = chronoTimeMs - prevOverall;
    setLaps([{ lapNumber: laps.length + 1, lapTime, overallTime: chronoTimeMs }, ...laps]);
  };

  // Interval Timer Logic
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (intervalRunning && intervalRemainingSec > 0) {
      timer = setInterval(() => {
        setIntervalRemainingSec((prev) => {
          if (prev <= 1) {
            playBeep(1760, 0.4);
            setIntervalRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [intervalRunning, intervalRemainingSec]);

  const applyIntervalPreset = (preset: "POMODORO" | "SHORT_BREAK" | "LONG_BREAK" | "SPRINT") => {
    setIntervalPreset(preset);
    setIntervalRunning(false);
    let sec = 25 * 60;
    if (preset === "SHORT_BREAK") sec = 5 * 60;
    if (preset === "LONG_BREAK") sec = 15 * 60;
    if (preset === "SPRINT") sec = 10 * 60;
    setIntervalDurationSec(sec);
    setIntervalRemainingSec(sec);
    playBeep(660);
  };

  // Metronome Logic
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (metronomeRunning) {
      const stepMs = (60 / bpm) * 1000;
      interval = setInterval(() => {
        setCurrentBeat((prev) => {
          const next = (prev + 1) % beatsPerBar;
          if (next === 0) {
            playBeep(1320, 0.08); // Accent on Beat 1
          } else {
            playBeep(660, 0.04);
          }
          return next;
        });
      }, stepMs);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [metronomeRunning, bpm, beatsPerBar]);

  const formatStopwatch = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const millis = Math.floor((ms % 1000) / 10);
    return {
      min: String(minutes).padStart(2, "0"),
      sec: String(seconds).padStart(2, "0"),
      ms: String(millis).padStart(2, "0")
    };
  };

  const formatTimer = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const textPrimary = theme === "dark" ? "text-neutral-100" : "text-neutral-900";
  const textSecondary = theme === "dark" ? "text-neutral-400" : "text-neutral-700";
  const textMuted = theme === "dark" ? "text-neutral-500" : "text-neutral-600";

  const sw = formatStopwatch(chronoTimeMs);

  return (
    <div className={`min-h-screen flex flex-col font-mono select-none transition-colors duration-200 ${
      theme === "dark" ? "bg-grid-pattern-dark text-[#ecebe6]" : "bg-grid-pattern-light text-[#111827]"
    }`}>
      
      {/* Top Header */}
      <header className={`h-14 border-b px-3 sm:px-6 flex items-center justify-between z-30 ${
        theme === "dark" ? "bg-[#181816]/95 border-[#383733]" : "bg-white/95 border-[#d4d2c7]"
      }`}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-amber-500 text-black flex items-center justify-center font-black text-xs shadow">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className={`font-black text-xs sm:text-sm tracking-wider uppercase ${textPrimary}`}>CHRONO-WATCH</span>
              <span className={`text-[8px] sm:text-[9px] font-bold px-1.5 py-0.5 border ${
                theme === "dark" ? "bg-[#262624] text-amber-400 border-amber-500/30" : "bg-amber-100 text-amber-800 border-amber-300"
              }`}>
                PRECISION CHRONOMETRY
              </span>
            </div>
          </div>
        </div>

        {/* Mode Selector Tabs in Header */}
        <div className="hidden md:flex items-center gap-1 border border-neutral-700/60 p-0.5">
          {(["CLOCK", "CHRONO", "INTERVAL", "METRONOME"] as Mode[]).map((m) => {
            const isSel = activeMode === m;
            return (
              <button
                key={m}
                onClick={() => { setActiveMode(m); playBeep(550); }}
                className={`px-3 py-1 text-xs font-black uppercase transition cursor-pointer ${
                  isSel ? "bg-amber-500 text-black shadow-xs" : "text-neutral-400 hover:text-white"
                }`}
              >
                {m}
              </button>
            );
          })}
        </div>

        {/* Color Palette Skin Selector */}
        <div className="flex items-center gap-1 border border-neutral-700/60 p-0.5">
          {(["AMBER", "MATRIX", "AVIATION", "NIGHT_RED"] as ColorSkin[]).map((s) => {
            const cfg = SKIN_CONFIG[s];
            const isSel = skin === s;
            return (
              <button
                key={s}
                onClick={() => { setSkin(s); playBeep(700); }}
                className={`px-2 py-1 text-[9px] font-black uppercase transition cursor-pointer flex items-center gap-1 ${
                  isSel ? `${cfg.bgAccent} text-black font-black shadow-xs` : "text-neutral-400 hover:text-white"
                }`}
                title={cfg.name}
              >
                <span className="w-1.5 h-1.5" style={{ backgroundColor: cfg.primaryHex }}></span>
                <span className="hidden lg:inline">{cfg.badge}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 border transition cursor-pointer ${
              soundEnabled
                ? theme === "dark" ? "border-amber-500/40 bg-amber-500/10 text-amber-400" : "border-amber-300 bg-amber-100 text-amber-800"
                : theme === "dark" ? "border-[#383733] text-neutral-500" : "border-neutral-300 text-neutral-400"
            }`}
            title="Toggle Sound"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <button
            onClick={toggleFullscreen}
            className={`p-2 border transition cursor-pointer ${
              theme === "dark" ? "border-[#383733] bg-[#1c1c1a] text-neutral-300" : "border-[#d4d2c7] bg-neutral-100 text-neutral-800"
            }`}
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className={`p-2 border transition cursor-pointer ${
              theme === "dark" ? "border-[#383733] bg-[#1c1c1a] text-amber-400" : "border-[#d4d2c7] bg-neutral-100 text-neutral-900 hover:bg-neutral-200"
            }`}
            title="Toggle Theme"
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Mobile Mode Switcher */}
      <div className="md:hidden flex items-center justify-around border-b border-[#383733] bg-[#141412] p-1 text-xs">
        {(["CLOCK", "CHRONO", "INTERVAL", "METRONOME"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => { setActiveMode(m); playBeep(550); }}
            className={`py-1 px-2 font-black uppercase ${activeMode === m ? "bg-amber-500 text-black" : "text-neutral-400"}`}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Main Clock & Mode Workspace */}
      <main className="flex-1 p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-6xl mx-auto w-full flex flex-col justify-center">

        {/* 1. MASTER WORLD CLOCK MODE */}
        {activeMode === "CLOCK" && (
          <div className="space-y-4 sm:space-y-6">
            
            {/* Simple Dashed Holding Box with Hover Glow Highlight */}
            <div className={`border-2 border-dashed p-6 sm:p-12 transition-all duration-200 group relative ${
              theme === "dark" 
                ? "border-[#383733] bg-[#181816] hover:border-amber-500 hover:bg-amber-500/[0.03] hover:shadow-lg hover:shadow-amber-500/5" 
                : "border-[#d4d2c7] bg-white hover:border-amber-600 hover:bg-amber-50/30 hover:shadow-md"
            }`}>
              
              {/* Header inside dashed box */}
              <div className="flex items-center justify-between text-[10px] sm:text-xs font-black uppercase text-neutral-500 group-hover:text-amber-500 transition-colors mb-2">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-amber-500 transition-transform group-hover:scale-125"></span>
                  <span>SYSTEM LOCAL TIME</span>
                </span>
                
                {/* 12H / 24H Toggle */}
                <button
                  onClick={() => setIs24Hour(!is24Hour)}
                  className={`px-2 py-0.5 border text-[9px] font-bold uppercase transition cursor-pointer ${
                    theme === "dark" 
                      ? "border-[#383733] group-hover:border-amber-500/50 bg-[#1c1c1a] text-neutral-300 group-hover:text-amber-300" 
                      : "border-neutral-300 group-hover:border-amber-500 bg-neutral-100 text-neutral-800"
                  }`}
                >
                  {is24Hour ? "24 HR" : "12 HR"}
                </button>
              </div>

              {/* Primary Huge Digits */}
              {now ? (() => {
                let hours = now.getHours();
                let ampm = "";
                if (!is24Hour) {
                  ampm = hours >= 12 ? "PM" : "AM";
                  hours = hours % 12 || 12;
                }
                const hrsStr = String(hours).padStart(2, "0");
                const minStr = String(now.getMinutes()).padStart(2, "0");
                const secStr = String(now.getSeconds()).padStart(2, "0");

                return (
                  <div className="font-mono text-5xl sm:text-8xl md:text-9xl font-black tracking-tight flex items-baseline justify-center gap-1 sm:gap-3 my-2 sm:my-4">
                    <span className={textPrimary}>{hrsStr}</span>
                    <span className="text-amber-500 animate-pulse">:</span>
                    <span className={textPrimary}>{minStr}</span>
                    <span className="text-amber-500 animate-pulse">:</span>
                    <span className="text-amber-500 font-bold">{secStr}</span>
                    {!is24Hour && (
                      <span className="text-xs sm:text-xl font-black text-amber-400 ml-1 sm:ml-2">{ampm}</span>
                    )}
                  </div>
                );
              })() : (
                <div className="text-4xl text-neutral-600 py-8 font-mono text-center">00:00:00</div>
              )}

              {/* Date Banner */}
              <div className={`text-center text-xs sm:text-sm font-bold uppercase tracking-widest ${textSecondary}`}>
                {now ? now.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" }) : "---"}
              </div>

              {/* Progress of Current Day */}
              {now && (
                <div className="mt-6 space-y-1.5 max-w-md mx-auto">
                  <div className="flex items-center justify-between text-[10px] text-neutral-500 font-bold font-mono">
                    <span>DAY CYCLE PROGRESS</span>
                    <span className="text-amber-500">
                      {Math.round(((now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) / 86400) * 100)}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-neutral-900 border border-[#383733] group-hover:border-amber-500/40 overflow-hidden transition-colors">
                    <div
                      className="h-full bg-amber-500 transition-all duration-300"
                      style={{ width: `${((now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) / 86400) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Ticking Epoch Tag */}
              <div className="text-center mt-4 text-[9px] text-neutral-500 font-mono">
                EPOCH: <strong className="text-neutral-400">{now ? Math.floor(now.getTime() / 1000) : "---"}</strong> • {now ? Intl.DateTimeFormat().resolvedOptions().timeZone : "SYNCING"}
              </div>

            </div>

            {/* Multi-Timezone Radar Grid & Time-Travel Slider */}
            <div className={`p-4 border ${theme === "dark" ? "border-[#383733] bg-[#181816]" : "border-[#d4d2c7] bg-white shadow-xs"} space-y-4`}>
              
              {/* Header with Offset Readout */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className={`text-xs font-black uppercase flex items-center gap-1.5 ${textPrimary}`}>
                  <Globe className={`w-3.5 h-3.5 ${SKIN_CONFIG[skin].accentClass}`} />
                  GLOBAL TIMEZONE RADAR MATRIX
                </div>

                <div className="flex items-center gap-2">
                  {tzOffsetHours !== 0 && (
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 border ${
                      theme === "dark" ? "border-amber-500/40 bg-amber-500/10 text-amber-300" : "border-amber-400 bg-amber-100 text-amber-900"
                    }`}>
                      OFFSET: {tzOffsetHours > 0 ? `+${tzOffsetHours}h` : `${tzOffsetHours}h`}
                    </span>
                  )}
                  <button
                    onClick={() => { setTzOffsetHours(0); playBeep(440); }}
                    disabled={tzOffsetHours === 0}
                    className={`px-2 py-0.5 border text-[9px] font-bold uppercase transition cursor-pointer ${
                      tzOffsetHours === 0
                        ? "border-neutral-800 text-neutral-600 cursor-not-allowed"
                        : theme === "dark" ? "border-[#383733] bg-[#262624] text-neutral-300 hover:text-white" : "border-neutral-300 bg-neutral-100 text-neutral-800"
                    }`}
                  >
                    Reset to Now
                  </button>
                </div>
              </div>

              {/* Time Travel 24-Hour Offset Slider */}
              <div className="space-y-1.5 p-3 border border-inherit bg-[#141412]/50">
                <div className="flex items-center justify-between text-[10px] font-mono font-bold text-neutral-500">
                  <span>-12h PAST</span>
                  <span className={SKIN_CONFIG[skin].textAccent}>TIME-TRAVEL SLIDER ({tzOffsetHours === 0 ? "LIVE NOW" : `${tzOffsetHours > 0 ? "+" : ""}${tzOffsetHours}h SHIFT`})</span>
                  <span>+12h FUTURE</span>
                </div>
                <input
                  type="range"
                  min={-12}
                  max={12}
                  step={1}
                  value={tzOffsetHours}
                  onChange={(e) => {
                    setTzOffsetHours(Number(e.target.value));
                    playBeep(600 + Number(e.target.value) * 20, 0.02);
                  }}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              {/* World Cities Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                {DEFAULT_ZONES.map((zone) => {
                  let timeStr = "--:--:--";
                  let dateStr = "---";
                  let isWorkHours = false;
                  let isNight = false;

                  if (now) {
                    try {
                      const targetMs = now.getTime() + tzOffsetHours * 3600 * 1000;
                      const targetDate = new Date(targetMs);
                      
                      timeStr = targetDate.toLocaleTimeString("en-GB", { timeZone: zone.tz, hour12: false });
                      dateStr = targetDate.toLocaleDateString("en-GB", { timeZone: zone.tz, month: "short", day: "numeric" });
                      
                      const hours = parseInt(timeStr.split(":")[0], 10);
                      isWorkHours = hours >= 9 && hours < 17;
                      isNight = hours < 6 || hours >= 22;
                    } catch {}
                  }

                  return (
                    <div
                      key={zone.code}
                      className={`p-3 border transition-colors ${
                        isWorkHours
                          ? theme === "dark" ? "border-emerald-500/40 bg-emerald-500/[0.04]" : "border-emerald-400 bg-emerald-50/50"
                          : isNight
                            ? theme === "dark" ? "border-[#242420] bg-[#10100e]" : "border-neutral-200 bg-neutral-100"
                            : theme === "dark" ? "border-[#383733] bg-[#181816]" : "border-[#d4d2c7] bg-white"
                      } space-y-1.5`}
                    >
                      <div className="flex items-center justify-between text-[9px] font-bold text-neutral-500 uppercase">
                        <span className="truncate">{zone.city}</span>
                        <span className={`text-[8px] px-1 py-0.2 border ${
                          isWorkHours
                            ? "border-emerald-500/50 text-emerald-400 bg-emerald-500/10"
                            : isNight
                              ? "border-neutral-700 text-neutral-500"
                              : "border-amber-500/40 text-amber-400"
                        }`}>
                          {isWorkHours ? "WORK" : isNight ? "NIGHT" : "OFF"}
                        </span>
                      </div>
                      
                      <div className={`text-lg sm:text-xl font-black font-mono ${textPrimary}`}>
                        {timeStr}
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-neutral-500 font-medium">
                        <span>{dateStr}</span>
                        <span className={SKIN_CONFIG[skin].textAccent}>[{zone.code}]</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}

        {/* 2. PRECISION SPLIT CHRONOMETER / STOPWATCH MODE */}
        {activeMode === "CHRONO" && (
          <div className="space-y-4">
            
            <div className={`p-6 sm:p-10 border-2 ${
              theme === "dark" ? "border-[#383733] bg-[#181816]" : "border-[#d4d2c7] bg-white shadow-md"
            } text-center space-y-6`}>
              
              <div className="text-[10px] uppercase font-bold text-amber-500">
                HIGH-RESOLUTION MILLISECOND TIMER
              </div>

              {/* Monospace Stopwatch Digits */}
              <div className="font-mono text-5xl sm:text-8xl md:text-9xl font-black flex items-baseline justify-center gap-1 sm:gap-2">
                <span className={textPrimary}>{sw.min}</span>
                <span className="text-neutral-600">:</span>
                <span className={textPrimary}>{sw.sec}</span>
                <span className="text-neutral-600">.</span>
                <span className="text-amber-500 text-3xl sm:text-5xl md:text-6xl w-20 sm:w-32 text-left">{sw.ms}</span>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={resetChrono}
                  className={`px-4 py-3 border text-xs font-black uppercase transition cursor-pointer flex items-center gap-1.5 ${
                    theme === "dark" ? "border-[#383733] bg-[#1c1c1a] text-neutral-300 hover:border-neutral-500" : "border-neutral-300 bg-neutral-100 hover:border-neutral-800 text-neutral-800"
                  }`}
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Reset</span>
                </button>

                <button
                  onClick={toggleChrono}
                  className={`px-8 py-3 font-black text-sm uppercase transition cursor-pointer shadow flex items-center gap-2 ${
                    chronoRunning ? "bg-rose-500 hover:bg-rose-400 text-white" : "bg-amber-500 hover:bg-amber-400 text-black shadow-amber-500/20"
                  }`}
                >
                  {chronoRunning ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                  <span>{chronoRunning ? "Stop" : "Start"}</span>
                </button>

                <button
                  onClick={recordLap}
                  disabled={!chronoRunning}
                  className={`px-4 py-3 border text-xs font-black uppercase transition cursor-pointer flex items-center gap-1.5 ${
                    !chronoRunning
                      ? "border-neutral-800 text-neutral-600 cursor-not-allowed"
                      : theme === "dark" ? "border-amber-500/40 bg-amber-500/10 text-amber-400" : "border-amber-300 bg-amber-100 text-amber-900"
                  }`}
                >
                  <Flag className="w-4 h-4" />
                  <span>Split Lap</span>
                </button>
              </div>

            </div>

            {/* Split Laps Matrix */}
            {laps.length > 0 && (
              <div className={`p-4 border ${theme === "dark" ? "border-[#383733] bg-[#181816]" : "border-[#d4d2c7] bg-white shadow-xs"} space-y-2`}>
                <div className="flex items-center justify-between text-xs font-black uppercase text-neutral-400">
                  <span>SPLIT LAPS ({laps.length})</span>
                  <span>TIME BUFFER</span>
                </div>

                <div className="max-h-60 overflow-y-auto divide-y divide-inherit font-mono text-xs">
                  {laps.map((lap) => {
                    const lsw = formatStopwatch(lap.lapTime);
                    const osw = formatStopwatch(lap.overallTime);
                    return (
                      <div key={lap.lapNumber} className="py-2 flex items-center justify-between">
                        <span className="font-bold text-amber-500">LAP {String(lap.lapNumber).padStart(2, "0")}</span>
                        <span className={textSecondary}>+{lsw.min}:{lsw.sec}.{lsw.ms}</span>
                        <span className={`font-black ${textPrimary}`}>{osw.min}:{osw.sec}.{osw.ms}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        )}

        {/* 3. INTERVAL & FOCUS TIMER MODE */}
        {activeMode === "INTERVAL" && (
          <div className="space-y-4">
            
            <div className={`p-6 sm:p-10 border-2 ${
              theme === "dark" ? "border-[#383733] bg-[#181816]" : "border-[#d4d2c7] bg-white shadow-md"
            } text-center space-y-6`}>
              
              {/* Presets */}
              <div className="flex items-center justify-center gap-2 flex-wrap">
                {[
                  { id: "POMODORO", label: "25m FOCUS", sec: 25 * 60 },
                  { id: "SHORT_BREAK", label: "5m BREAK", sec: 5 * 60 },
                  { id: "LONG_BREAK", label: "15m BREAK", sec: 15 * 60 },
                  { id: "SPRINT", label: "10m SPRINT", sec: 10 * 60 },
                ].map((p) => (
                  <button
                    key={p.id}
                    onClick={() => applyIntervalPreset(p.id as any)}
                    className={`px-3 py-1.5 border text-xs font-black uppercase transition cursor-pointer ${
                      intervalPreset === p.id
                        ? "bg-amber-500 text-black border-amber-500"
                        : theme === "dark" ? "border-[#383733] bg-[#141412] text-neutral-400" : "border-neutral-300 bg-neutral-100 text-neutral-700"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Large Timer Countdown */}
              <div className="font-mono text-6xl sm:text-9xl font-black tracking-tight my-4">
                <span className={intervalRemainingSec === 0 ? "text-rose-500" : textPrimary}>
                  {formatTimer(intervalRemainingSec)}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full max-w-md mx-auto h-2 bg-neutral-800 border border-[#383733] overflow-hidden">
                <div
                  className="h-full bg-amber-500 transition-all duration-300"
                  style={{ width: `${((intervalDurationSec - intervalRemainingSec) / Math.max(1, intervalDurationSec)) * 100}%` }}
                />
              </div>

              {/* Controls */}
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => { setIntervalRunning(false); setIntervalRemainingSec(intervalDurationSec); playBeep(330); }}
                  className={`px-4 py-3 border text-xs font-black uppercase transition cursor-pointer flex items-center gap-1.5 ${
                    theme === "dark" ? "border-[#383733] bg-[#1c1c1a] text-neutral-300" : "border-neutral-300 bg-neutral-100 text-neutral-800"
                  }`}
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Reset</span>
                </button>

                <button
                  onClick={() => { setIntervalRunning(!intervalRunning); playBeep(intervalRunning ? 440 : 880); }}
                  className={`px-8 py-3 font-black text-sm uppercase transition cursor-pointer shadow flex items-center gap-2 ${
                    intervalRunning ? "bg-rose-500 hover:bg-rose-400 text-white" : "bg-amber-500 hover:bg-amber-400 text-black shadow-amber-500/20"
                  }`}
                >
                  {intervalRunning ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                  <span>{intervalRunning ? "Pause" : "Start Focus"}</span>
                </button>
              </div>

            </div>

          </div>
        )}

        {/* 4. ACOUSTIC METRONOME MODE */}
        {activeMode === "METRONOME" && (
          <div className="space-y-4">
            
            <div className={`p-6 sm:p-10 border-2 ${
              theme === "dark" ? "border-[#383733] bg-[#181816]" : "border-[#d4d2c7] bg-white shadow-md"
            } text-center space-y-6`}>
              
              <div className="text-[10px] uppercase font-bold text-amber-500">
                PULSE BPM GENERATOR
              </div>

              {/* Large BPM Readout */}
              <div className="font-mono text-6xl sm:text-9xl font-black my-2">
                <span className={textPrimary}>{bpm}</span>
                <span className="text-xs text-amber-500 ml-2">BPM</span>
              </div>

              {/* Visual Beat Indicators */}
              <div className="flex items-center justify-center gap-3">
                {Array.from({ length: beatsPerBar }).map((_, bIdx) => {
                  const isActive = metronomeRunning && currentBeat === bIdx;
                  return (
                    <div
                      key={bIdx}
                      className={`w-8 h-8 sm:w-12 sm:h-12 border-2 flex items-center justify-center font-black text-xs sm:text-sm transition-all ${
                        isActive
                          ? bIdx === 0 ? "bg-amber-500 text-black border-amber-400 scale-110 shadow-lg shadow-amber-500/20" : "bg-white text-black border-white scale-105"
                          : theme === "dark" ? "border-neutral-700 bg-neutral-900 text-neutral-600" : "border-neutral-300 bg-neutral-100 text-neutral-400"
                      }`}
                    >
                      {bIdx + 1}
                    </div>
                  );
                })}
              </div>

              {/* Tempo Slider */}
              <div className="max-w-md mx-auto space-y-2">
                <input
                  type="range"
                  min={40}
                  max={240}
                  value={bpm}
                  onChange={(e) => setBpm(Number(e.target.value))}
                  className="w-full accent-amber-500"
                />
                <div className="flex items-center justify-between text-[10px] font-bold text-neutral-500">
                  <span>40 GRAVE</span>
                  <span>120 MODERATO</span>
                  <span>240 PRESTISSIMO</span>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => { setMetronomeRunning(!metronomeRunning); setCurrentBeat(0); }}
                  className={`px-8 py-3 font-black text-sm uppercase transition cursor-pointer shadow flex items-center gap-2 ${
                    metronomeRunning ? "bg-rose-500 hover:bg-rose-400 text-white" : "bg-amber-500 hover:bg-amber-400 text-black shadow-amber-500/20"
                  }`}
                >
                  {metronomeRunning ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                  <span>{metronomeRunning ? "Stop Pulse" : "Start Pulse"}</span>
                </button>
              </div>

            </div>

          </div>
        )}

      </main>

      {/* Cockpit Status Bar Footer */}
      <footer className={`h-8 border-t px-4 sm:px-6 flex items-center justify-between text-[9px] sm:text-[10px] font-mono ${
        theme === "dark" ? "bg-[#181816]/95 border-[#383733] text-neutral-500" : "bg-white/95 border-[#d4d2c7] text-neutral-700"
      }`}>
        <div className="flex items-center gap-2">
          <span>ENGINE: <strong>CHRONO-WATCH TIME SYSTEM</strong></span>
          <span>•</span>
          <span>SYNC: <strong>SYSTEM CLOCK 100% OFFLINE</strong></span>
        </div>
        <div className="flex items-center gap-2">
          <span>AUDIO: <strong>WEB AUDIO SYNTH</strong></span>
          <span>•</span>
          <span>PRECISION: <strong>SUB-MILLISECOND</strong></span>
        </div>
      </footer>

    </div>
  );
}
