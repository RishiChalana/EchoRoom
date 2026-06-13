"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getHealth } from "@/lib/api";

// Three.js sphere loaded client-side only
const SphereScene = dynamic(() => import("@/components/landing/SphereScene"), { ssr: false });

// ── Custom cursor ─────────────────────────────────────────────────────────────
function CustomCursor() {
  const cursorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = cursorRef.current;
    if (!el) return;

    let raf = 0;
    let cx = -100, cy = -100;

    function onMove(e: MouseEvent) { cx = e.clientX; cy = e.clientY; }
    function tick() {
      el!.style.transform = `translate(${cx - 12}px, ${cy - 12}px)`;
      raf = requestAnimationFrame(tick);
    }
    function onEnter() { el!.style.width = "48px"; el!.style.height = "48px"; el!.style.marginLeft = "-12px"; el!.style.marginTop = "-12px"; }
    function onLeave() { el!.style.width = "24px"; el!.style.height = "24px"; el!.style.marginLeft = "0"; el!.style.marginTop = "0"; }

    document.addEventListener("mousemove", onMove);
    raf = requestAnimationFrame(tick);
    const links = document.querySelectorAll("a, button");
    links.forEach((n) => { n.addEventListener("mouseenter", onEnter); n.addEventListener("mouseleave", onLeave); });

    return () => {
      document.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
      links.forEach((n) => { n.removeEventListener("mouseenter", onEnter); n.removeEventListener("mouseleave", onLeave); });
    };
  }, []);

  return (
    <div
      ref={cursorRef}
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-[9999] h-6 w-6 rounded-full mix-blend-difference"
      style={{ background: "white", transition: "width 0.15s ease, height 0.15s ease" }}
    />
  );
}

// ── Fade-up wrapper ───────────────────────────────────────────────────────────
function FadeSection({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Visible by default for reduced motion / no JS
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) return;

    el.style.opacity = "0";
    el.style.transform = "translateY(28px)";

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.transition = "opacity 0.75s ease, transform 0.75s ease";
          el.style.opacity = "1";
          el.style.transform = "translateY(0)";
          obs.disconnect();
        }
      },
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return <section ref={ref as React.RefObject<HTMLElement>} className={className}>{children}</section>;
}

// ── Navigation ────────────────────────────────────────────────────────────────
function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() { setScrolled(window.scrollY > 40); }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className="fixed left-0 right-0 top-0 z-50 flex h-16 items-center justify-between px-8 transition-all duration-300"
      style={{
        backdropFilter: scrolled ? "blur(16px)" : "none",
        background: scrolled ? "rgba(10,10,10,0.75)" : "transparent",
        borderBottom: scrolled ? "1px solid rgba(255,255,255,0.06)" : "none",
      }}
    >
      <span className="font-label text-[13px] font-semibold uppercase tracking-[0.2em] text-white">
        ECHOROOM
      </span>
      <div className="flex items-center gap-3">
        <Link
          href="/login"
          className="flex h-9 items-center rounded-lg border border-white/20 px-5 font-label text-[13px] font-medium uppercase tracking-wide text-white/80 transition-colors hover:border-white/40 hover:text-white"
        >
          Log In
        </Link>
        <Link
          href="/register"
          className="flex h-9 items-center rounded-lg px-5 font-label text-[13px] font-medium uppercase tracking-wide text-black transition-opacity hover:opacity-80"
          style={{ background: "white" }}
        >
          Sign Up
        </Link>
      </div>
    </header>
  );
}

// ── System status ─────────────────────────────────────────────────────────────
function StatusDot() {
  const [healthy, setHealthy] = useState<boolean | null>(null);

  useEffect(() => {
    getHealth()
      .then((h) => setHealthy(h.status === "healthy"))
      .catch(() => setHealthy(false));
  }, []);

  const color = healthy === null ? "#555" : healthy ? "#4ade80" : "#ef4444";
  const label = healthy === null ? "Checking…" : healthy ? "Systems Operational" : "Degraded";

  return (
    <div className="mt-5 flex items-center justify-center gap-2 font-label text-[11px] uppercase tracking-[0.2em] text-white/35">
      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {label}
    </div>
  );
}

// ── Room data ─────────────────────────────────────────────────────────────────
const ROOMS = [
  { code: "01", title: "Technical", sub: "The Grid", desc: "Whiteboard precision. Engineered delivery for technical audiences." },
  { code: "02", title: "Interview", sub: "The Focus", desc: "Composed and evaluative. The silence between questions matters." },
  { code: "03", title: "Presentation", sub: "The Stage", desc: "Scale and authority. Perform at size without losing the room." },
  { code: "04", title: "General", sub: "The Flow", desc: "Human conversation. Warm, unguarded, fully present." },
];

// ── Page ──────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <div style={{ background: "#0a0a0a", cursor: "none" }}>
      <CustomCursor />
      <Nav />

      {/* Hero */}
      <section className="relative flex h-screen flex-col items-center justify-center overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <SphereScene />
        </div>

        <div className="relative z-10 px-6 text-center">
          <p className="font-label text-[11px] uppercase tracking-[0.25em] text-white/35">
            Communication Intelligence
          </p>
          <h1
            className="mt-4 font-display font-black leading-none tracking-tight"
            style={{ fontSize: "clamp(52px, 10vw, 120px)" }}
          >
            <span className="block text-white">PRACTICE</span>
            <span
              className="block"
              style={{ WebkitTextStroke: "1px rgba(255,255,255,0.55)", color: "transparent" }}
            >
              FOR THE
            </span>
            <span className="block text-white">MOMENT.</span>
          </h1>

          <p className="mx-auto mt-8 max-w-[460px] font-sans text-[16px] leading-[1.8] text-white/45">
            A private flight simulator for your communication. Real-time AI coaching
            for technical presentations, interviews, and high-stakes conversations.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/register"
              className="flex h-11 items-center rounded-lg px-7 font-label text-[13px] font-semibold uppercase tracking-wide text-black transition-opacity hover:opacity-85"
              style={{ background: "white" }}
            >
              Start Practicing
            </Link>
            <Link
              href="/login"
              className="flex h-11 items-center rounded-lg border border-white/20 px-7 font-label text-[13px] font-semibold uppercase tracking-wide text-white/65 transition-colors hover:border-white/40 hover:text-white"
            >
              Sign In →
            </Link>
          </div>

          <StatusDot />
        </div>

        <div className="absolute bottom-10 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1 animate-bounce">
          <div className="h-10 w-px bg-gradient-to-b from-white/25 to-transparent" />
        </div>
      </section>

      {/* Philosophy */}
      <FadeSection className="mx-auto max-w-[820px] px-8 py-28 text-center">
        <p className="font-label text-[11px] uppercase tracking-[0.25em] text-white/30">
          Why It Works
        </p>
        <h2
          className="mt-6 font-display font-bold text-white"
          style={{ fontSize: "clamp(30px, 4vw, 50px)", lineHeight: 1.18 }}
        >
          The gap between knowing and performing
          <br />
          <span style={{ WebkitTextStroke: "1px rgba(255,255,255,0.4)", color: "transparent" }}>
            closes through repetition.
          </span>
        </h2>
        <p className="mx-auto mt-8 max-w-[560px] font-sans text-[16px] leading-[1.8] text-white/45">
          EchoRoom replicates the psychological pressure of real contexts so your
          nervous system can practice the response — not just your mind.
        </p>
      </FadeSection>

      {/* Contextual Realities */}
      <FadeSection className="mx-auto max-w-[1100px] px-8 pb-28">
        <p className="font-label text-[11px] uppercase tracking-[0.25em] text-white/30">Four Contexts</p>
        <h2
          className="mt-3 font-display font-bold text-white"
          style={{ fontSize: "clamp(26px, 3.5vw, 42px)" }}
        >
          Contextual Realities
        </h2>

        <div className="mt-10 grid grid-cols-1 gap-px bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
          {ROOMS.map((room) => (
            <div key={room.code} className="group bg-[#0a0a0a] p-8 transition-colors hover:bg-[#111]">
              <span className="font-label text-[11px] font-medium uppercase tracking-widest text-white/25">
                {room.code}
              </span>
              <p className="mt-4 font-display text-[22px] font-bold text-white">{room.title}</p>
              <p className="font-label text-[12px] uppercase tracking-wide text-white/35">{room.sub}</p>
              <p className="mt-4 font-sans text-[14px] leading-[1.75] text-white/45">{room.desc}</p>
              <div className="mt-6 h-px w-8 bg-white/20 transition-all duration-500 group-hover:w-full" />
            </div>
          ))}
        </div>
      </FadeSection>

      {/* Insight Engine */}
      <FadeSection className="border-t border-white/[0.06]">
        <div className="mx-auto max-w-[1100px] px-8 py-28">
          <div className="grid grid-cols-1 gap-16 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="font-label text-[11px] uppercase tracking-[0.25em] text-white/30">
                After Every Session
              </p>
              <h2
                className="mt-4 font-display font-bold text-white"
                style={{ fontSize: "clamp(28px, 3.5vw, 44px)", lineHeight: 1.2 }}
              >
                The Insight Engine
                <br />
                <span style={{ WebkitTextStroke: "1px rgba(255,255,255,0.4)", color: "transparent" }}>
                  finds the signal.
                </span>
              </h2>
              <p className="mt-6 font-sans text-[16px] leading-[1.8] text-white/45">
                Every session generates a full coaching report — engagement arc, filler word
                frequency, pacing analysis, and AI-rewritten versions of your weakest moments.
              </p>
              <Link
                href="/register"
                className="mt-8 inline-flex h-11 items-center rounded-lg border border-white/20 px-6 font-label text-[13px] font-semibold uppercase tracking-wide text-white/65 transition-colors hover:border-white/40 hover:text-white"
              >
                See a Sample Report →
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-px bg-white/10">
              {[
                { label: "Overall Score", value: "88", unit: "/100" },
                { label: "Words / Min", value: "142", unit: "wpm" },
                { label: "Engagement", value: "91", unit: "%" },
                { label: "Filler Words", value: "3", unit: "detected" },
              ].map((m) => (
                <div key={m.label} className="bg-[#0a0a0a] p-8">
                  <p className="font-label text-[11px] uppercase tracking-widest text-white/30">{m.label}</p>
                  <p className="mt-3 font-display text-[40px] font-bold leading-none text-white">
                    {m.value}
                    <span className="font-sans text-[16px] font-normal text-white/35"> {m.unit}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </FadeSection>

      {/* Footer CTA */}
      <FadeSection className="border-t border-white/[0.06]">
        <div className="mx-auto max-w-[720px] px-8 py-28 text-center">
          <h2
            className="font-display font-bold text-white"
            style={{ fontSize: "clamp(34px, 5vw, 60px)", lineHeight: 1.12 }}
          >
            The moment is coming.
            <br />
            <span style={{ WebkitTextStroke: "1px rgba(255,255,255,0.45)", color: "transparent" }}>
              Practice is now.
            </span>
          </h2>
          <Link
            href="/register"
            className="mt-10 inline-flex h-12 items-center rounded-lg px-8 font-label text-[13px] font-semibold uppercase tracking-wide text-black transition-opacity hover:opacity-85"
            style={{ background: "white" }}
          >
            Start Your First Session
          </Link>
        </div>
      </FadeSection>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] px-8 py-8">
        <div className="mx-auto flex max-w-[1100px] flex-col items-center justify-between gap-3 font-label text-[12px] uppercase tracking-widest text-white/25 sm:flex-row">
          <span>© 2025 EchoRoom Systems.</span>
          <div className="flex gap-6">
            <Link href="#" className="transition-colors hover:text-white/50">Privacy</Link>
            <Link href="#" className="transition-colors hover:text-white/50">Terms</Link>
            <Link href="#" className="transition-colors hover:text-white/50">Security</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
