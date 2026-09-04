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

export default function ChronoWatchCockpit() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [activeMode, setActiveMode] = useState<Mode>("CLOCK");
  const [now, setNow] = useState<Date | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [is24Hour, setIs24Hour] = useState<boolean>(true);

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
            
            {/* Physical Watch Bezel Case with Corner Screws & Lugs */}
            <div className={`border-4 ${
              theme === "dark" ? "border-[#2c2b27] bg-[#141412] shadow-2xl shadow-black/80" : "border-[#b8b5a8] bg-[#f5f4ef] shadow-xl"
            } p-3 sm:p-5 relative`}>
              
              {/* Outer Physical Watch Lugs / Mount Accents */}
              <div className="absolute -top-3 left-8 w-12 h-3 bg-[#383733] border-t border-x border-[#525049] hidden sm:block"></div>
              <div className="absolute -top-3 right-8 w-12 h-3 bg-[#383733] border-t border-x border-[#525049] hidden sm:block"></div>
              <div className="absolute -bottom-3 left-8 w-12 h-3 bg-[#383733] border-b border-x border-[#525049] hidden sm:block"></div>
              <div className="absolute -bottom-3 right-8 w-12 h-3 bg-[#383733] border-b border-x border-[#525049] hidden sm:block"></div>

              {/* 4 Corner Screws (Hex / Torx Bolts) */}
              <div className="absolute top-2 left-2 w-3.5 h-3.5 rounded-none border border-[#525049] bg-[#242420] flex items-center justify-center font-mono text-[9px] text-neutral-400 select-none">
                +
              </div>
              <div className="absolute top-2 right-2 w-3.5 h-3.5 rounded-none border border-[#525049] bg-[#242420] flex items-center justify-center font-mono text-[9px] text-neutral-400 select-none">
                +
              </div>
              <div className="absolute bottom-2 left-2 w-3.5 h-3.5 rounded-none border border-[#525049] bg-[#242420] flex items-center justify-center font-mono text-[9px] text-neutral-400 select-none">
                +
              </div>
              <div className="absolute bottom-2 right-2 w-3.5 h-3.5 rounded-none border border-[#525049] bg-[#242420] flex items-center justify-center font-mono text-[9px] text-neutral-400 select-none">
                +
              </div>

              {/* Top Bezel Case Technical Engravings */}
              <div className="flex items-center justify-between px-3 py-1 mb-2 border-b border-[#2c2b27] text-[8px] sm:text-[10px] font-mono font-bold tracking-widest text-neutral-500 uppercase">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-amber-500 animate-ping"></span>
                  <span>CALIBRE CW-01 // 32.768 kHz</span>
                </span>
                <span className="hidden sm:inline">SWISS INDUSTRIAL SPEC • 50 BAR</span>
                <span className="text-amber-500 font-black">
                  {now ? Intl.DateTimeFormat().resolvedOptions().timeZone.toUpperCase() : "SYNCING"}
                </span>
              </div>

              {/* Inner Recessed Matte LCD Display Box */}
              <div className={`p-4 sm:p-10 border-2 ${
                theme === "dark" 
                  ? "border-amber-500/40 bg-[#0f0f0d] shadow-inner" 
                  : "border-amber-600 bg-amber-50/50 shadow-inner"
              } text-center relative overflow-hidden`}>
                
                {/* LCD Top Status Flags */}
                <div className="flex items-center justify-between text-[9px] sm:text-[11px] font-black uppercase text-amber-500 mb-2">
                  <span className="flex items-center gap-1">
                    <span className="px-1.5 py-0.2 border border-amber-500/40 bg-amber-500/10">GPS LOCK</span>
                    <span className="px-1.5 py-0.2 border border-emerald-500/40 bg-emerald-500/10 text-emerald-400">RTC 1.0</span>
                  </span>
                  
                  {/* 12H / 24H Toggle Button */}
                  <button
                    onClick={() => setIs24Hour(!is24Hour)}
                    className={`px-2 py-0.5 border text-[9px] font-bold uppercase transition cursor-pointer ${
                      theme === "dark" ? "border-amber-500/50 bg-[#1c1c1a] text-amber-300 hover:bg-amber-500/20" : "border-amber-400 bg-white text-amber-900"
                    }`}
                  >
                    MODE: {is24Hour ? "24 HR" : "12 HR (AM/PM)"}
                  </button>
                </div>

                {/* Primary Huge Monospace Digits */}
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
                    <div className="relative my-2 sm:my-4">
                      {/* Faint Background 88:88:88 Ghost Segments */}
                      <div className={`absolute inset-0 font-mono text-5xl sm:text-8xl md:text-9xl font-black tracking-tight flex items-baseline justify-center gap-1 sm:gap-3 pointer-events-none opacity-5 select-none ${textPrimary}`}>
                        <span>88</span>
                        <span>:</span>
                        <span>88</span>
                        <span>:</span>
                        <span>88</span>
                      </div>

                      {/* Active Live Digits */}
                      <div className="font-mono text-5xl sm:text-8xl md:text-9xl font-black tracking-tight flex items-baseline justify-center gap-1 sm:gap-3">
                        <span className={textPrimary}>{hrsStr}</span>
                        <span className="text-amber-500 animate-pulse">:</span>
                        <span className={textPrimary}>{minStr}</span>
                        <span className="text-amber-500 animate-pulse">:</span>
                        <span className="text-amber-500 font-bold">{secStr}</span>
                        {!is24Hour && (
                          <span className="text-xs sm:text-xl font-black text-amber-400 ml-1 sm:ml-2">{ampm}</span>
                        )}
                      </div>
                    </div>
                  );
                })() : (
                  <div className="text-4xl text-neutral-600 py-8 font-mono">00:00:00</div>
                )}

                {/* Date Banner */}
                <div className={`text-xs sm:text-sm font-bold uppercase tracking-widest ${textSecondary}`}>
                  {now ? now.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" }) : "---"}
                </div>

                {/* Day Progress Indicator */}
                {now && (
                  <div className="mt-6 space-y-1.5 max-w-md mx-auto">
                    <div className="flex items-center justify-between text-[10px] text-neutral-500 font-bold font-mono">
                      <span>SOLAR CYCLE PROGRESS</span>
                      <span className="text-amber-500">
                        {Math.round(((now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) / 86400) * 100)}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-neutral-900 border border-[#383733] overflow-hidden">
                      <div
                        className="h-full bg-amber-500"
                        style={{ width: `${((now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) / 86400) * 100}%` }}
                      />
                    </div>
                  </div>
                )}

              </div>

              {/* Bottom Bezel Case Engraving Bar */}
              <div className="flex items-center justify-between px-3 py-1.5 mt-2 border-t border-[#2c2b27] text-[8px] sm:text-[9px] font-mono text-neutral-500 uppercase">
                <span>EPOCH: {now ? Math.floor(now.getTime() / 1000) : "---"}</span>
                <span className="text-neutral-400">CHRONO DYNAMICS GMBH</span>
                <span>CHASSIS: TITANIUM-9</span>
              </div>

            </div>

            {/* Multi-Timezone Radar Grid */}
            <div className="space-y-2">
              <div className={`text-xs font-black uppercase flex items-center gap-1.5 ${textPrimary}`}>
                <Globe className="w-3.5 h-3.5 text-sky-500" />
                GLOBAL TIMEZONE RADAR MATRIX
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                {DEFAULT_ZONES.map((zone) => {
                  let timeStr = "--:--:--";
                  let dateStr = "---";
                  if (now) {
                    try {
                      timeStr = now.toLocaleTimeString("en-GB", { timeZone: zone.tz, hour12: false });
                      dateStr = now.toLocaleDateString("en-GB", { timeZone: zone.tz, month: "short", day: "numeric" });
                    } catch {}
                  }

                  return (
                    <div
                      key={zone.code}
                      className={`p-3 border ${theme === "dark" ? "border-[#383733] bg-[#181816]" : "border-[#d4d2c7] bg-white shadow-xs"} space-y-1`}
                    >
                      <div className="flex items-center justify-between text-[9px] font-bold text-neutral-500 uppercase">
                        <span>{zone.city}</span>
                        <span className="text-amber-500">[{zone.code}]</span>
                      </div>
                      <div className={`text-lg sm:text-xl font-black font-mono ${textPrimary}`}>
                        {timeStr}
                      </div>
                      <div className="text-[10px] text-neutral-500 font-medium">
                        {dateStr}
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
