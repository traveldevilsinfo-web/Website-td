"use client";

import { useRouter } from "next/navigation";
import { OtpLogin } from "./OtpLogin";

export function LoginCard({ title, next }: { title: string; next: string }) {
  const router = useRouter();
  return (
    <section className="mx-auto max-w-md px-4 py-20">
      <div className="rounded-[2rem] border border-line bg-white p-8 shadow-[var(--shadow-lift)]">
        <h1 className="display text-3xl">{title}</h1>
        <p className="mb-6 mt-2 text-muted">Log in with your mobile number. We&apos;ll text you a one-time code.</p>
        <OtpLogin onDone={() => { router.replace(next); router.refresh(); }} />
      </div>
    </section>
  );
}
