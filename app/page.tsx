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
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Calendar,
  BarChart3,
  Compass
} from "lucide-react";

type Mode = "CLOCK" | "CHRONO" | "INTERVAL";

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

export interface MoonPhaseInfo {
  phaseName: string;
  fraction: number; // 0.0 - 1.0 (illumination)
  phaseIndex: number; // 0 - 7
  ageDays: number;
  symbol: string;
}

export function getMoonPhase(date: Date): MoonPhaseInfo {
  // Known reference new moon: January 11, 2024 at 11:57 UTC
  const refNewMoon = new Date(Date.UTC(2024, 0, 11, 11, 57, 0)).getTime();
  const synodicMonth = 29.53058867 * 86400 * 1000;
  const diff = date.getTime() - refNewMoon;
  const phaseCycle = (diff % synodicMonth + synodicMonth) % synodicMonth;
  const normalizedPhase = phaseCycle / synodicMonth; // 0.0 to 1.0
  const ageDays = normalizedPhase * 29.53;

  // 8 Phases
  const phaseIndex = Math.floor(normalizedPhase * 8) % 8;
  const phases = [
    { name: "NEW MOON", symbol: "🌑" },
    { name: "WAXING CRESCENT", symbol: "🌒" },
    { name: "FIRST QUARTER", symbol: "🌓" },
    { name: "WAXING GIBBOUS", symbol: "🌔" },
    { name: "FULL MOON", symbol: "🌕" },
    { name: "WANING GIBBOUS", symbol: "🌖" },
    { name: "LAST QUARTER", symbol: "🌗" },
    { name: "WANING CRESCENT", symbol: "🌘" },
  ];

  // Illumination calculation (approximate cosine curve)
  const illumination = 0.5 * (1 - Math.cos(2 * Math.PI * normalizedPhase));

  return {
    phaseName: phases[phaseIndex].name,
    fraction: illumination,
    phaseIndex,
    ageDays: Math.round(ageDays * 10) / 10,
    symbol: phases[phaseIndex].symbol,
  };
}

export default function ChronoWatchCockpit() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [activeMode, setActiveMode] = useState<Mode>("CLOCK");
  const [now, setNow] = useState<Date | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [is24Hour, setIs24Hour] = useState<boolean>(true);
  const [showWorldClock, setShowWorldClock] = useState<boolean>(false);
  const [showAstronomy, setShowAstronomy] = useState<boolean>(false);
  const [telemetryView, setTelemetryView] = useState<"DAY" | "MONTH" | "YEAR">("DAY");

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

  const textPrimary = theme === "dark" ? "text-neutral-100" : "text-neutral-950 font-black";
  const textSecondary = theme === "dark" ? "text-neutral-400" : "text-neutral-800 font-semibold";
  const textMuted = theme === "dark" ? "text-neutral-500" : "text-neutral-700 font-medium";

  const sw = formatStopwatch(chronoTimeMs);

  return (
    <div className={`min-h-screen flex flex-col font-mono select-none transition-colors duration-200 ${
      theme === "dark" ? "bg-grid-pattern-dark text-[#ecebe6]" : "bg-grid-pattern-light text-neutral-950 font-semibold"
    }`}>
      
      {/* Top Header */}
      <header className={`h-14 border-b px-3 sm:px-6 flex items-center justify-between z-30 ${
        theme === "dark" ? "bg-[#181816]/95 border-[#383733]" : "bg-white/95 border-neutral-300 shadow-xs"
      }`}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-amber-500 text-black flex items-center justify-center font-black text-xs shadow">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className={`font-black text-xs sm:text-sm tracking-wider uppercase ${textPrimary}`}>CHRONO-WATCH</span>
              <span className={`text-[8px] sm:text-[9px] font-bold px-1.5 py-0.5 border ${
                theme === "dark" ? "bg-[#262624] text-amber-400 border-amber-500/30" : "bg-amber-100 text-amber-900 border-amber-400 font-black"
              }`}>
                PRECISION CHRONOMETRY
              </span>
            </div>
          </div>
        </div>

        {/* Mode Selector Tabs in Header */}
        <div className={`hidden md:flex items-center gap-1 border p-0.5 ${
          theme === "dark" ? "border-neutral-700/60 bg-neutral-900/50" : "border-neutral-300 bg-neutral-100"
        }`}>
          {(["CLOCK", "CHRONO", "INTERVAL"] as Mode[]).map((m) => {
            const isSel = activeMode === m;
            return (
              <button
                key={m}
                onClick={() => { setActiveMode(m); playBeep(550); }}
                className={`px-3 py-1 text-xs font-black uppercase transition cursor-pointer ${
                  isSel
                    ? "bg-amber-500 text-black shadow-xs font-black"
                    : theme === "dark" ? "text-neutral-400 hover:text-white" : "text-neutral-700 hover:text-black hover:bg-white/80"
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
                ? theme === "dark" ? "border-amber-500/40 bg-amber-500/10 text-amber-400" : "border-amber-400 bg-amber-100 text-amber-950 font-bold"
                : theme === "dark" ? "border-[#383733] text-neutral-500" : "border-neutral-300 text-neutral-600 bg-white"
            }`}
            title="Toggle Sound"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <button
            onClick={toggleFullscreen}
            className={`p-2 border transition cursor-pointer ${
              theme === "dark" ? "border-[#383733] bg-[#1c1c1a] text-neutral-300" : "border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-100"
            }`}
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className={`p-2 border transition cursor-pointer ${
              theme === "dark" ? "border-[#383733] bg-[#1c1c1a] text-amber-400" : "border-neutral-300 bg-white text-neutral-950 hover:bg-neutral-100 font-bold"
            }`}
            title="Toggle Theme"
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Mobile Mode Switcher */}
      <div className={`md:hidden flex items-center justify-around border-b p-1 text-xs ${
        theme === "dark" ? "border-[#383733] bg-[#141412]" : "border-neutral-300 bg-neutral-100"
      }`}>
        {(["CLOCK", "CHRONO", "INTERVAL"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => { setActiveMode(m); playBeep(550); }}
            className={`py-1 px-2 font-black uppercase ${
              activeMode === m 
                ? "bg-amber-500 text-black shadow-xs" 
                : theme === "dark" ? "text-neutral-400" : "text-neutral-700"
            }`}
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
            
            {/* Minimal & Sober Dashed Watch Box with Hardware Corner Reticles */}
            <div className={`border-2 border-dashed p-8 sm:p-14 transition-all duration-300 relative group ${
              theme === "dark" 
                ? "border-[#33322e] bg-[#161614] hover:border-neutral-400 lcd-matrix-dark" 
                : "border-neutral-400 bg-white shadow-sm hover:border-neutral-800 lcd-matrix-light"
            }`}>
              
              {/* 4 Hardware Corner Reticles / Precision Crosshairs */}
              <div className={`absolute -top-2.5 -left-2.5 text-xs font-mono font-black select-none pointer-events-none transition-colors ${
                theme === "dark" ? "text-neutral-600 group-hover:text-amber-500" : "text-neutral-400 group-hover:text-amber-600"
              }`}>+</div>
              <div className={`absolute -top-2.5 -right-2.5 text-xs font-mono font-black select-none pointer-events-none transition-colors ${
                theme === "dark" ? "text-neutral-600 group-hover:text-amber-500" : "text-neutral-400 group-hover:text-amber-600"
              }`}>+</div>
              <div className={`absolute -bottom-2.5 -left-2.5 text-xs font-mono font-black select-none pointer-events-none transition-colors ${
                theme === "dark" ? "text-neutral-600 group-hover:text-amber-500" : "text-neutral-400 group-hover:text-amber-600"
              }`}>+</div>
              <div className={`absolute -bottom-2.5 -right-2.5 text-xs font-mono font-black select-none pointer-events-none transition-colors ${
                theme === "dark" ? "text-neutral-600 group-hover:text-amber-500" : "text-neutral-400 group-hover:text-amber-600"
              }`}>+</div>

              {/* Header inside box */}
              <div className={`flex items-center justify-between text-[10px] sm:text-xs font-mono font-bold uppercase tracking-wider mb-3 ${
                theme === "dark" ? "text-neutral-500" : "text-neutral-700"
              }`}>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-amber-500 animate-pulse"></span>
                  <span>{now ? Intl.DateTimeFormat().resolvedOptions().timeZone : "LOCAL TIME"}</span>
                </div>
                
                {/* 12H / 24H Toggle */}
                <button
                  onClick={() => setIs24Hour(!is24Hour)}
                  className={`px-2 py-0.5 border text-[9px] font-mono font-bold uppercase transition cursor-pointer ${
                    theme === "dark" 
                      ? "border-neutral-700 bg-neutral-900 text-neutral-400 hover:text-white" 
                      : "border-neutral-400 bg-neutral-100 text-neutral-900 hover:bg-neutral-200 font-black"
                  }`}
                >
                  {is24Hour ? "24H" : "12H"}
                </button>
              </div>

              {/* Linear 60-Second Perimeter Tick Index */}
              {now && (() => {
                const currentSec = now.getSeconds();
                return (
                  <div className="my-3 space-y-1">
                    <div className="grid grid-cols-60 gap-[1.5px] sm:gap-[2px] h-2 sm:h-2.5 items-end">
                      {Array.from({ length: 60 }).map((_, secIdx) => {
                        const isPastOrCurrent = secIdx <= currentSec;
                        const isCurrent = secIdx === currentSec;
                        const isMajorQuarter = secIdx % 15 === 0; // 0, 15, 30, 45
                        const isFiveSec = secIdx % 5 === 0;

                        return (
                          <div
                            key={secIdx}
                            className={`transition-all duration-150 ${
                              isMajorQuarter ? "h-full" : isFiveSec ? "h-4/5" : "h-1/2"
                            } ${
                              isCurrent
                                ? "bg-amber-400 scale-y-125 shadow-xs shadow-amber-400"
                                : isPastOrCurrent
                                  ? theme === "dark" ? "bg-amber-500/70" : "bg-amber-600/80"
                                  : theme === "dark" ? "bg-neutral-800" : "bg-neutral-300"
                            }`}
                            title={`${secIdx}s`}
                          />
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-between text-[7px] sm:text-[8px] font-mono font-bold text-neutral-500 tracking-wider">
                      <span>00s</span>
                      <span>15s</span>
                      <span>30s</span>
                      <span>45s</span>
                      <span className={theme === "dark" ? "text-amber-400 font-black" : "text-amber-700 font-black"}>
                        {String(currentSec).padStart(2, "0")}s / 60s
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Primary Clock Digits with Sub-pixel Kerning */}
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
                  <div className="font-mono text-6xl sm:text-8xl md:text-9xl font-black tracking-tighter flex items-baseline justify-center gap-1 sm:gap-2 my-1 sm:my-3">
                    <span className={theme === "dark" ? "text-neutral-100 drop-shadow-sm" : "text-neutral-950 font-black"}>{hrsStr}</span>
                    <span className={`animate-pulse ${theme === "dark" ? "text-neutral-600" : "text-neutral-400 font-bold"}`}>:</span>
                    <span className={theme === "dark" ? "text-neutral-100 drop-shadow-sm" : "text-neutral-950 font-black"}>{minStr}</span>
                    <span className={`animate-pulse ${theme === "dark" ? "text-neutral-600" : "text-neutral-400 font-bold"}`}>:</span>
                    <span className={theme === "dark" ? "text-neutral-100 drop-shadow-sm" : "text-neutral-950 font-black"}>{secStr}</span>
                    {!is24Hour && (
                      <span className={`text-xs sm:text-lg font-black ml-2 ${theme === "dark" ? "text-neutral-500" : "text-neutral-700"}`}>{ampm}</span>
                    )}
                  </div>
                );
              })() : (
                <div className={`text-4xl py-8 font-mono text-center ${theme === "dark" ? "text-neutral-600" : "text-neutral-400 font-bold"}`}>00:00:00</div>
              )}

              {/* Sober Date Line with Calibrated Spacing */}
              <div className={`text-center text-xs sm:text-sm font-mono font-bold uppercase tracking-[0.25em] mt-1 ${
                theme === "dark" ? "text-neutral-400" : "text-neutral-700"
              }`}>
                {now ? now.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "short", day: "numeric" }) : "---"}
              </div>

              {/* Calendar Telemetry: Day / Month / Year Progress */}
              {now && (() => {
                const year = now.getFullYear();
                const month = now.getMonth(); // 0-indexed
                const date = now.getDate();
                
                // 1. Day Progress
                const totalSecondsInDay = 86400;
                const elapsedSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
                const dayProgress = (elapsedSeconds / totalSecondsInDay) * 100;
                const hours = now.getHours() + now.getMinutes() / 60;
                const isDaylight = hours >= 6 && hours < 18;

                // 2. Month Progress
                const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
                const monthElapsedDays = (date - 1) + (elapsedSeconds / totalSecondsInDay);
                const monthProgress = (monthElapsedDays / daysInCurrentMonth) * 100;

                // 3. Year Progress & Day-of-Year
                const startOfYear = new Date(year, 0, 1);
                const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
                const totalDaysInYear = isLeapYear ? 366 : 365;
                const diffTime = now.getTime() - startOfYear.getTime();
                const dayOfYear = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
                const yearProgress = (diffTime / (totalDaysInYear * 24 * 3600 * 1000)) * 100;
                const quarter = Math.floor(month / 3) + 1;

                let activePercentage = dayProgress;
                let activeTitle = isDaylight ? "DAYLIGHT CYCLE" : "NOCTURNAL CYCLE";
                let activeSubtitle = `${hours.toFixed(1)}h / 24.0h`;

                if (telemetryView === "MONTH") {
                  activePercentage = monthProgress;
                  activeTitle = `${now.toLocaleDateString(undefined, { month: "long" }).toUpperCase()} PROGRESS`;
                  activeSubtitle = `DAY ${date} OF ${daysInCurrentMonth}`;
                } else if (telemetryView === "YEAR") {
                  activePercentage = yearProgress;
                  activeTitle = `YEAR ${year} • Q${quarter}`;
                  activeSubtitle = `DAY ${dayOfYear} OF ${totalDaysInYear}`;
                }

                return (
                  <div className={`mt-6 pt-6 border-t border-dashed space-y-3 max-w-xl mx-auto ${
                    theme === "dark" ? "border-neutral-800/80" : "border-neutral-300"
                  }`}>
                    
                    {/* View Switcher Tabs (Day / Month / Year) */}
                    <div className="flex items-center justify-between gap-2">
                      <div className={`flex items-center gap-1 border p-0.5 ${
                        theme === "dark" ? "border-neutral-800 bg-neutral-900/50" : "border-neutral-300 bg-neutral-100"
                      }`}>
                        {(["DAY", "MONTH", "YEAR"] as const).map((view) => {
                          const isSel = telemetryView === view;
                          return (
                            <button
                              key={view}
                              onClick={() => { setTelemetryView(view); playBeep(700, 0.02); }}
                              className={`px-2 py-0.5 text-[9px] font-mono font-bold uppercase transition cursor-pointer ${
                                isSel
                                  ? "bg-amber-500 text-black shadow-xs font-black"
                                  : theme === "dark" ? "text-neutral-500 hover:text-neutral-300" : "text-neutral-700 hover:text-black"
                              }`}
                            >
                              {view}
                            </button>
                          );
                        })}
                      </div>

                      {/* Right Telemetry Readout */}
                      <span className={`text-[10px] font-mono font-black tracking-wider ${
                        theme === "dark" ? "text-neutral-300" : "text-neutral-950"
                      }`}>
                        {activePercentage.toFixed(1)}% <span className={theme === "dark" ? "text-neutral-500 font-normal" : "text-neutral-600 font-normal"}>ELAPSED</span>
                      </span>
                    </div>

                    {/* Status Header */}
                    <div className={`flex items-center justify-between text-[10px] font-mono font-bold uppercase ${
                      theme === "dark" ? "text-neutral-500" : "text-neutral-700"
                    }`}>
                      <div className="flex items-center gap-1.5">
                        {telemetryView === "DAY" ? (
                          isDaylight ? <Sun className="w-3.5 h-3.5 text-amber-500" /> : <Moon className="w-3.5 h-3.5 text-sky-500" />
                        ) : (
                          <Calendar className="w-3.5 h-3.5 text-amber-500" />
                        )}
                        <span className={theme === "dark" ? "text-neutral-400" : "text-neutral-900 font-bold"}>{activeTitle}</span>
                      </div>
                      <span className={`font-mono text-[9px] font-semibold ${theme === "dark" ? "text-neutral-400" : "text-neutral-700"}`}>{activeSubtitle}</span>
                    </div>

                    {/* Progress Track */}
                    <div className={`relative h-2 w-full border overflow-hidden ${
                      theme === "dark" ? "bg-neutral-900 border-neutral-800" : "bg-neutral-200 border-neutral-300"
                    }`}>
                      <div
                        className="h-full bg-amber-500 transition-all duration-1000 ease-linear"
                        style={{ width: `${activePercentage}%` }}
                      />
                    </div>

                    {/* Scale Markings depending on active view */}
                    <div className={`flex items-center justify-between text-[8px] font-mono uppercase tracking-wider font-semibold ${
                      theme === "dark" ? "text-neutral-600" : "text-neutral-600"
                    }`}>
                      {telemetryView === "DAY" && (
                        <>
                          <span>00:00 MIDNIGHT</span>
                          <span>06:00 DAWN</span>
                          <span>12:00 NOON</span>
                          <span>18:00 DUSK</span>
                          <span>24:00 END</span>
                        </>
                      )}
                      {telemetryView === "MONTH" && (
                        <>
                          <span>DAY 1</span>
                          <span>WEEK 1</span>
                          <span>MID-MONTH</span>
                          <span>WEEK 3</span>
                          <span>DAY {daysInCurrentMonth}</span>
                        </>
                      )}
                      {telemetryView === "YEAR" && (
                        <>
                          <span>JAN (Q1)</span>
                          <span>APR (Q2)</span>
                          <span>JUL (Q3)</span>
                          <span>OCT (Q4)</span>
                          <span>DEC (END)</span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })()}

            </div>

            {/* Collapsible Global Timezone Box */}
            <div className={`border transition-all duration-200 ${
              theme === "dark" ? "border-[#383733] bg-[#181816]" : "border-neutral-300 bg-white shadow-xs"
            }`}>
              {/* Clickable Header Button */}
              <button
                onClick={() => {
                  setShowWorldClock(!showWorldClock);
                  playBeep(showWorldClock ? 440 : 660);
                }}
                className={`w-full p-4 flex items-center justify-between text-left cursor-pointer transition-colors ${
                  theme === "dark" ? "hover:bg-[#20201d]" : "hover:bg-neutral-50"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`p-1 border ${
                    theme === "dark" ? "border-amber-500/30 bg-amber-500/10 text-amber-400" : "border-amber-400 bg-amber-100 text-amber-950 font-bold"
                  }`}>
                    <Globe className="w-4 h-4" />
                  </div>
                  <div>
                    <div className={`text-xs font-black uppercase tracking-wider ${textPrimary}`}>
                      GLOBAL TIMEZONE MATRIX
                    </div>
                    <div className={`text-[10px] font-mono ${theme === "dark" ? "text-neutral-500" : "text-neutral-600 font-semibold"}`}>
                      {showWorldClock ? "8 WORLD CITIES ACTIVE" : "CLICK TO EXPAND 8 WORLD CITIES"}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-[9px] font-mono font-bold px-2 py-0.5 border ${
                    showWorldClock
                      ? theme === "dark" ? "border-amber-500/40 bg-amber-500/10 text-amber-300" : "border-amber-400 bg-amber-100 text-amber-950 font-black"
                      : theme === "dark" ? "border-neutral-800 text-neutral-500" : "border-neutral-300 text-neutral-800 font-bold bg-neutral-100"
                  }`}>
                    {showWorldClock ? "OPEN" : "COLLAPSED"}
                  </span>
                  {showWorldClock ? (
                    <ChevronUp className={`w-4 h-4 ${theme === "dark" ? "text-neutral-400" : "text-neutral-700"}`} />
                  ) : (
                    <ChevronDown className={`w-4 h-4 ${theme === "dark" ? "text-neutral-400" : "text-neutral-700"}`} />
                  )}
                </div>
              </button>

              {/* Collapsible Content */}
              {showWorldClock && (
                <div className={`p-4 border-t ${theme === "dark" ? "border-[#2c2b28] bg-[#141412]" : "border-neutral-200 bg-neutral-50/80"} space-y-4`}>
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
                          className={`p-3 border transition-colors ${
                            theme === "dark" 
                              ? "border-[#383733] bg-[#181816] hover:border-neutral-500" 
                              : "border-neutral-300 bg-white shadow-xs hover:border-neutral-700"
                          } space-y-1.5`}
                        >
                          <div className={`flex items-center justify-between text-[9px] font-bold uppercase ${
                            theme === "dark" ? "text-neutral-500" : "text-neutral-700 font-black"
                          }`}>
                            <span className="truncate">{zone.city}</span>
                            <span className={`text-[8px] font-mono px-1 py-0.2 border ${
                              theme === "dark" 
                                ? "border-amber-500/30 text-amber-400 bg-amber-500/5" 
                                : "border-neutral-300 text-neutral-800 bg-neutral-100 font-bold"
                            }`}>
                              {zone.code}
                            </span>
                          </div>
                          
                          <div className={`text-lg sm:text-xl font-black font-mono ${theme === "dark" ? "text-neutral-100" : "text-neutral-950 font-black"}`}>
                            {timeStr}
                          </div>

                          <div className={`flex items-center justify-between text-[10px] font-bold ${
                            theme === "dark" ? "text-neutral-500" : "text-neutral-700"
                          }`}>
                            <span>{dateStr}</span>
                            <span className={theme === "dark" ? "text-amber-500" : "text-amber-700 font-black"}>ZONE</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Collapsible Moon Phase & Astronomy Matrix Box */}
            <div className={`border transition-all duration-200 ${
              theme === "dark" ? "border-[#383733] bg-[#181816]" : "border-neutral-300 bg-white shadow-xs"
            }`}>
              {/* Clickable Header Button */}
              <button
                onClick={() => {
                  setShowAstronomy(!showAstronomy);
                  playBeep(showAstronomy ? 440 : 720);
                }}
                className={`w-full p-4 flex items-center justify-between text-left cursor-pointer transition-colors ${
                  theme === "dark" ? "hover:bg-[#20201d]" : "hover:bg-neutral-50"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`p-1 border ${
                    theme === "dark" ? "border-amber-500/30 bg-amber-500/10 text-amber-400" : "border-amber-400 bg-amber-100 text-amber-950 font-bold"
                  }`}>
                    <Compass className="w-4 h-4" />
                  </div>
                  <div>
                    <div className={`text-xs font-black uppercase tracking-wider ${textPrimary}`}>
                      LUNAR PHASE & ASTRONOMY MATRIX
                    </div>
                    <div className={`text-[10px] font-mono ${theme === "dark" ? "text-neutral-500" : "text-neutral-600 font-semibold"}`}>
                      {now ? `${getMoonPhase(now).phaseName} • ${(getMoonPhase(now).fraction * 100).toFixed(0)}% ILLUMINATION` : "ASTRONOMICAL TELEMETRY"}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-[9px] font-mono font-bold px-2 py-0.5 border ${
                    showAstronomy
                      ? theme === "dark" ? "border-amber-500/40 bg-amber-500/10 text-amber-300" : "border-amber-400 bg-amber-100 text-amber-950 font-black"
                      : theme === "dark" ? "border-neutral-800 text-neutral-500" : "border-neutral-300 text-neutral-800 font-bold bg-neutral-100"
                  }`}>
                    {showAstronomy ? "OPEN" : "COLLAPSED"}
                  </span>
                  {showAstronomy ? (
                    <ChevronUp className={`w-4 h-4 ${theme === "dark" ? "text-neutral-400" : "text-neutral-700"}`} />
                  ) : (
                    <ChevronDown className={`w-4 h-4 ${theme === "dark" ? "text-neutral-400" : "text-neutral-700"}`} />
                  )}
                </div>
              </button>

              {/* Collapsible Content */}
              {showAstronomy && now && (() => {
                const moon = getMoonPhase(now);
                const allPhases = [
                  { name: "NEW MOON", symbol: "🌑", idx: 0 },
                  { name: "WAXING CRESCENT", symbol: "🌒", idx: 1 },
                  { name: "FIRST QUARTER", symbol: "🌓", idx: 2 },
                  { name: "WAXING GIBBOUS", symbol: "🌔", idx: 3 },
                  { name: "FULL MOON", symbol: "🌕", idx: 4 },
                  { name: "WANING GIBBOUS", symbol: "🌖", idx: 5 },
                  { name: "LAST QUARTER", symbol: "🌗", idx: 6 },
                  { name: "WANING CRESCENT", symbol: "🌘", idx: 7 },
                ];

                return (
                  <div className={`p-4 border-t ${theme === "dark" ? "border-[#2c2b28] bg-[#141412]" : "border-neutral-200 bg-neutral-50/80"} space-y-4`}>
                    
                    {/* Primary Lunar Telemetry Bar */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                      <div className={`p-3 border ${theme === "dark" ? "border-[#383733] bg-[#181816]" : "border-neutral-300 bg-white shadow-xs"} space-y-1`}>
                        <div className={`text-[9px] font-bold uppercase ${theme === "dark" ? "text-neutral-500" : "text-neutral-700 font-bold"}`}>CURRENT PHASE</div>
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{moon.symbol}</span>
                          <span className={`text-xs font-black font-mono ${theme === "dark" ? "text-neutral-100" : "text-neutral-950 font-black"}`}>{moon.phaseName}</span>
                        </div>
                      </div>

                      <div className={`p-3 border ${theme === "dark" ? "border-[#383733] bg-[#181816]" : "border-neutral-300 bg-white shadow-xs"} space-y-1`}>
                        <div className={`text-[9px] font-bold uppercase ${theme === "dark" ? "text-neutral-500" : "text-neutral-700 font-bold"}`}>ILLUMINATION</div>
                        <div className={`text-lg font-black font-mono ${theme === "dark" ? "text-amber-500" : "text-amber-700"}`}>
                          {(moon.fraction * 100).toFixed(1)}%
                        </div>
                        <div className={`text-[9px] font-medium ${theme === "dark" ? "text-neutral-500" : "text-neutral-600"}`}>SURFACE REFLECTIVITY</div>
                      </div>

                      <div className={`p-3 border ${theme === "dark" ? "border-[#383733] bg-[#181816]" : "border-neutral-300 bg-white shadow-xs"} space-y-1`}>
                        <div className={`text-[9px] font-bold uppercase ${theme === "dark" ? "text-neutral-500" : "text-neutral-700 font-bold"}`}>LUNAR AGE</div>
                        <div className={`text-lg font-black font-mono ${theme === "dark" ? "text-neutral-100" : "text-neutral-950 font-black"}`}>
                          {moon.ageDays} <span className={`text-xs font-normal ${theme === "dark" ? "text-neutral-500" : "text-neutral-600"}`}>DAYS</span>
                        </div>
                        <div className={`text-[9px] font-medium ${theme === "dark" ? "text-neutral-500" : "text-neutral-600"}`}>IN 29.53d SYNODIC CYCLE</div>
                      </div>

                      <div className={`p-3 border ${theme === "dark" ? "border-[#383733] bg-[#181816]" : "border-neutral-300 bg-white shadow-xs"} space-y-1`}>
                        <div className={`text-[9px] font-bold uppercase ${theme === "dark" ? "text-neutral-500" : "text-neutral-700 font-bold"}`}>NEXT FULL MOON</div>
                        <div className={`text-lg font-black font-mono ${theme === "dark" ? "text-neutral-100" : "text-neutral-950 font-black"}`}>
                          {moon.ageDays < 14.8 ? (14.8 - moon.ageDays).toFixed(1) : (29.53 - moon.ageDays + 14.8).toFixed(1)} <span className={`text-xs font-normal ${theme === "dark" ? "text-neutral-500" : "text-neutral-600"}`}>DAYS</span>
                        </div>
                        <div className={`text-[9px] font-medium ${theme === "dark" ? "text-neutral-500" : "text-neutral-600"}`}>PEAK ILLUMINATION</div>
                      </div>
                    </div>

                    {/* 8-Phase Visual Track */}
                    <div className="space-y-2">
                      <div className={`text-[9px] font-mono font-bold uppercase tracking-wider ${
                        theme === "dark" ? "text-neutral-500" : "text-neutral-700"
                      }`}>
                        29.5-DAY SYNODIC PHASE PROGRESSION
                      </div>

                      <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                        {allPhases.map((p) => {
                          const isActive = moon.phaseIndex === p.idx;
                          return (
                            <div
                              key={p.name}
                              className={`p-2 border text-center transition-colors ${
                                isActive
                                  ? theme === "dark" ? "border-amber-500 bg-amber-500/10 shadow-xs shadow-amber-500/20" : "border-amber-500 bg-amber-100 font-black shadow-xs"
                                  : theme === "dark" ? "border-neutral-800 bg-neutral-900/50 opacity-60" : "border-neutral-300 bg-white opacity-80"
                              }`}
                            >
                              <div className="text-base my-0.5">{p.symbol}</div>
                              <div className={`text-[7px] font-mono font-bold truncate ${
                                isActive 
                                  ? theme === "dark" ? "text-amber-400" : "text-amber-950 font-black" 
                                  : theme === "dark" ? "text-neutral-500" : "text-neutral-700 font-bold"
                              }`}>
                                {p.name}
                              </div>
                              {isActive && (
                                <div className="text-[6px] font-bold bg-amber-500 text-black px-1 py-0.2 mt-1 uppercase">
                                  ACTIVE
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                  </div>
                );
              })()}
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
