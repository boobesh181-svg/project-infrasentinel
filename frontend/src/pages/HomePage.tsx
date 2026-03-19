import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  FileLock2,
  Layers3,
  Radar,
  Sparkles,
  Zap,
} from "lucide-react";
import ArchitectureSection from "../sections/ArchitectureSection";
import DemoSection from "../sections/DemoSection";
import HowItWorksSection from "../sections/HowItWorksSection";
import ImpactSection from "../sections/ImpactSection";
import ProblemSection from "../sections/ProblemSection";
import SolutionSection from "../sections/SolutionSection";
import UseCasesSection from "../sections/UseCasesSection";

const workflowSteps = [
  {
    title: "Capture",
    detail: "Create material events with evidence at source",
    accent: "from-[#1da1f2] to-[#0077ff]",
  },
  {
    title: "Verify",
    detail: "Review and validate with role-gated controls",
    accent: "from-[#11c88f] to-[#00a86b]",
  },
  {
    title: "Approve",
    detail: "Finalize records with immutable state transitions",
    accent: "from-[#f5a623] to-[#ff6a00]",
  },
  {
    title: "Lock",
    detail: "Generate audit-ready reports and freeze history",
    accent: "from-[#7b5cff] to-[#4f2bff]",
  },
];

const features = [
  {
    icon: FileLock2,
    title: "Immutable Evidence",
    body: "Cryptographic hashes, tamper detection, and complete provenance.",
  },
  {
    icon: Radar,
    title: "Live Verification Radar",
    body: "Track what is pending, what is blocked, and what is report-ready.",
  },
  {
    icon: Layers3,
    title: "Tenant-Safe Architecture",
    body: "Strict organization isolation across data, workflows, and audit trails.",
  },
  {
    icon: Building2,
    title: "Built For Enterprise Sites",
    body: "Fast onboarding for projects, suppliers, and reviewer teams at scale.",
  },
];

const HomePage = () => {
  const [spot, setSpot] = useState({ x: 50, y: 24 });

  const spotStyle = useMemo(
    () => ({
      background: `radial-gradient(500px circle at ${spot.x}% ${spot.y}%, rgba(14, 165, 233, 0.18), transparent 70%)`,
    }),
    [spot.x, spot.y]
  );

  return (
    <div
      className="relative overflow-hidden bg-[#04070f] font-body text-white"
      onMouseMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 100;
        const y = ((event.clientY - rect.top) / rect.height) * 100;
        setSpot({ x, y });
      }}
    >
      <div className="pointer-events-none absolute inset-0" style={spotStyle} />
      <div className="pointer-events-none absolute -top-40 right-[-120px] h-[560px] w-[560px] rounded-full bg-gradient-to-br from-[#00c6ff]/35 to-[#0047ff]/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-180px] left-[-140px] h-[460px] w-[460px] rounded-full bg-gradient-to-br from-[#ff6a00]/25 to-[#ff006a]/20 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.05),transparent_45%)]" />

      <section id="product" className="relative mx-auto w-full max-w-6xl px-6 pb-20 pt-20 md:pt-24">
        <div className="grid items-center gap-12 lg:grid-cols-[1.08fr_0.92fr]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
          >
            <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#9ed2ff] backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" />
              Verified Climate Infrastructure
            </p>

            <h1 className="font-display mt-6 text-[2.5rem] font-bold leading-[0.98] text-white md:text-[4.5rem]">
              Move Fast.
              <br />
              Trust Every
              <br />
              Carbon Record.
            </h1>

            <p className="mt-6 max-w-xl text-base text-[#b8c9ea] md:text-lg">
              Infrasentinel brings Nike-level confidence and Stripe-level clarity to climate data operations.
              Teams capture evidence, verify workflow, and publish audit-ready reports without friction.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <a
                href="/login"
                className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#081427] transition hover:translate-y-[-1px] hover:bg-[#d8e7ff]"
              >
                Enter Platform
                <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href="#how-it-works"
                className="rounded-full border border-white/25 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:border-[#7bc1ff] hover:bg-white/10"
              >
                Explore Workflow
              </a>
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              {[
                { label: "Events Processed", value: "1.4M+" },
                { label: "Audit Pass Rate", value: "99.97%" },
                { label: "Report Time", value: "< 4 min" },
              ].map((item, idx) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + idx * 0.1, duration: 0.5 }}
                  className="rounded-2xl border border-white/15 bg-white/10 px-4 py-4 shadow-[0_16px_34px_rgba(0,0,0,0.25)] backdrop-blur"
                >
                  <p className="text-2xl font-bold text-white">{item.value}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[#a6bce0]">{item.label}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.08 }}
            className="relative"
          >
            <div className="absolute -left-6 top-6 hidden h-24 w-24 rounded-2xl bg-gradient-to-br from-[#00c6ff] to-[#005bff] blur-[1px] md:block" />
            <div className="relative rounded-[28px] border border-white/20 bg-[#0b1223]/80 p-6 shadow-[0_28px_65px_rgba(0,0,0,0.45)] backdrop-blur md:p-7">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#9bc7ff]">Live Verification Board</p>
                <span className="rounded-full bg-[#1f3d71] px-3 py-1 text-xs font-semibold text-[#b8d8ff]">Realtime</span>
              </div>

              <div className="mt-5 space-y-3">
                {workflowSteps.map((step, idx) => (
                  <motion.div
                    key={step.title}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + idx * 0.1, duration: 0.45 }}
                    className="group rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-[#5aa8ff] hover:bg-white/[0.06]"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-1 h-2.5 w-2.5 rounded-full bg-gradient-to-r ${step.accent}`} />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-white">{step.title}</p>
                          <Zap className="h-4 w-4 text-[#8ab0e4] transition group-hover:text-[#58b6ff]" />
                        </div>
                        <p className="mt-1 text-sm text-[#a6bce0]">{step.detail}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="mt-5 rounded-2xl bg-gradient-to-r from-[#143066] to-[#0d4c8f] p-4 text-[#d9ebff]">
                <p className="text-xs uppercase tracking-[0.14em] text-[#b3d8ff]">Current Signal</p>
                <p className="mt-1 text-sm font-semibold text-white">78 records moved from verification to approved in the last 24h.</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="relative overflow-hidden border-y border-white/10 bg-[#050b18] py-5">
        <motion.div
          initial={{ x: 0 }}
          animate={{ x: ["0%", "-50%"] }}
          transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
          className="flex w-[200%] gap-8 whitespace-nowrap text-xs font-semibold uppercase tracking-[0.3em] text-[#88a7d2]"
        >
          {Array.from({ length: 18 }).map((_, i) => (
            <span key={i}>Evidence Integrity • Workflow Certainty • Audit Confidence •</span>
          ))}
        </motion.div>
      </section>

      <section id="highlights" className="relative border-y border-white/10 bg-[#070f1f] py-16">
        <div className="mx-auto w-full max-w-6xl px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-[#6d8fbd]">How It Works</p>
              <h2 className="font-display mt-2 text-3xl font-bold text-white md:text-4xl">One Flow, Zero Guesswork</h2>
            </div>
            <p className="max-w-xl text-sm text-[#9ab3d8] md:text-base">
              Each record moves through a deterministic path with role checks and immutable audit events.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {features.map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <motion.article
                  key={feature.title}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ duration: 0.45, delay: idx * 0.08 }}
                  className="group rounded-3xl border border-white/10 bg-white/[0.04] p-6 transition hover:-translate-y-1 hover:border-[#60b5ff]"
                >
                  <div className="inline-flex rounded-2xl bg-[#12305e] p-3 text-[#76c2ff]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-white">{feature.title}</h3>
                  <p className="mt-2 text-sm text-[#9ab3d8]">{feature.body}</p>
                  <div className="mt-4 text-sm font-semibold text-[#69beff] opacity-0 transition group-hover:opacity-100">
                    Learn more
                  </div>
                </motion.article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="platform-cta" className="relative mx-auto w-full max-w-6xl px-6 py-20">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="overflow-hidden rounded-[30px] border border-[#cfe0ff] bg-gradient-to-br from-[#0e1e45] via-[#11295d] to-[#0e4788] p-8 md:p-12"
        >
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[#8bc4ff]">Enterprise Ready</p>
              <h2 className="font-display mt-3 text-3xl font-bold leading-tight text-white md:text-4xl">
                Your Climate Ledger,
                <br />
                Designed For Speed
              </h2>
              <p className="mt-4 max-w-lg text-[#c6ddff]">
                Launch a high-trust data backbone for projects, suppliers, verifiers, and approvers.
                Replace scattered spreadsheets with one secure operating layer.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <a
                  href="/login"
                  className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#0e234c] transition hover:translate-y-[-1px]"
                >
                  Get Started
                </a>
                <a
                  href="/about"
                  className="rounded-full border border-[#8eb9ff] px-6 py-3 text-sm font-semibold text-[#d7e7ff] transition hover:bg-white/10"
                >
                  Read Architecture
                </a>
              </div>
            </div>

            <div className="rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.17em] text-[#a8ccff]">System Health</p>
              <div className="mt-4 space-y-3">
                {[
                  { name: "Workflow Integrity", value: "100%" },
                  { name: "Audit Trace Coverage", value: "100%" },
                  { name: "Tenant Isolation", value: "Enforced" },
                ].map((item) => (
                  <div key={item.name} className="flex items-center justify-between rounded-xl border border-white/20 bg-white/10 px-4 py-3">
                    <p className="text-sm text-[#d6e6ff]">{item.name}</p>
                    <p className="inline-flex items-center gap-2 text-sm font-semibold text-white">
                      <BadgeCheck className="h-4 w-4 text-[#63f0ba]" />
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      <div className="relative z-10">
        <ProblemSection />
        <SolutionSection />
        <HowItWorksSection />
        <ArchitectureSection />
        <UseCasesSection />
        <ImpactSection />
        <DemoSection />
      </div>
    </div>
  );
};

export default HomePage;
