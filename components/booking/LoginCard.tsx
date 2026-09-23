"use client";

import Image from "next/image";
import { Caveat } from "next/font/google";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarCheck, Headphones, ShieldCheck, UserRound, Users, Wallet } from "lucide-react";
import { AuthForm, type AuthMode } from "./AuthForm";

const script = Caveat({ subsets: ["latin"], weight: "700" });

/** Full-bleed login / register page: story on the left, form card on the right. */
export function LoginCard({ next, whatsapp, image, travellers, mode: initial = "login" }: {
  next: string; whatsapp: string; image: string | null; travellers: string | null; mode?: AuthMode;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>(initial);
  const perks = [
    { icon: ShieldCheck, label: "Secure login" },
    { icon: CalendarCheck, label: "All your trips in one place" },
    { icon: Wallet, label: "Pay balance anytime" },
  ];
  const trust = [
    { icon: ShieldCheck, label: "Private & secure" },
    travellers && { icon: Users, label: `${travellers} travellers` },
    { icon: Headphones, label: "WhatsApp support" },
  ].filter(Boolean) as { icon: typeof Users; label: string }[];

  return (
    <section className="relative isolate -mt-px overflow-hidden bg-ink text-white">
      {image && <Image src={image} alt="" fill priority sizes="100vw" className="-z-10 object-cover" />}
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/75 via-black/45 to-black/25" />

      <div className="mx-auto grid min-h-[calc(100svh-5rem)] max-w-7xl items-center gap-10 px-4 py-12 lg:grid-cols-[1fr_28rem] lg:py-16">
        <div className="max-lg:hidden">
          <p className={`${script.className} text-4xl leading-none text-accent`}>Your next adventure</p>
          <h1 className="display mt-2 text-6xl xl:text-7xl">Starts here</h1>
          <p className="mt-5 max-w-lg text-lg font-semibold text-white/85">
            Log in to see your bookings, pay the balance and get your trip details, all in one place.
          </p>
          <ul className="mt-8 flex flex-wrap gap-3">
            {perks.map(({ icon: Icon, label }) => (
              <li key={label} className="glass-dark flex items-center gap-2.5 rounded-full py-1.5 pl-1.5 pr-4 text-sm font-bold ring-1 ring-white/20">
                <span className="grid size-8 place-items-center rounded-full bg-brand"><Icon className="size-4" aria-hidden /></span>{label}
              </li>
            ))}
          </ul>
        </div>

        <div className="overflow-hidden rounded-[2rem] bg-white text-ink shadow-2xl">
          <div className="bg-gradient-to-b from-brand/[0.07] to-transparent px-7 pb-5 pt-7 text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-white">
              <UserRound className="size-3.5" aria-hidden />{mode === "login" ? "Welcome back" : "Join the crew"}
            </span>
            <h2 className="headline mt-3 text-2xl">{mode === "login" ? "Log in to your account" : "Create your account"}</h2>
            <p className="mt-1 text-sm font-semibold text-muted">{mode === "login" ? "Continue your journey with Travel Devils" : "Book faster and keep every trip in one place"}</p>
          </div>
          <div className="px-7 pb-6">
            <AuthForm whatsapp={whatsapp} mode={initial} onModeChange={setMode} onDone={() => { router.replace(next); router.refresh(); }} />
          </div>
          <ul className="flex flex-wrap justify-center gap-x-5 gap-y-2 border-t border-line px-6 py-4 text-xs font-bold text-muted">
            {trust.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-1.5"><Icon className="size-4 text-brand" aria-hidden />{label}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
