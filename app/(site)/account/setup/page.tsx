import type { Metadata } from "next";
import Link from "next/link";
import { readSetupToken } from "@/lib/guest";
import { AccountSetupForm } from "@/components/booking/AccountSetupForm";

export const metadata: Metadata = { title: "Create your account", robots: { index: false } };

/** Landing page of the "Create your account" link in the booking email. */
export default async function AccountSetup({ searchParams }: PageProps<"/account/setup">) {
  const token = (await searchParams).token;
  const c = typeof token === "string" ? await readSetupToken(token) : null;
  return (
    <section className="mx-auto max-w-md px-4 py-16">
      <h1 className="display text-4xl">{c ? "Create your account" : "Link expired"}</h1>
      {c && typeof token === "string" ? (
        <>
          <p className="mt-2 text-muted">Hi {c.name?.split(" ")[0] ?? "there"}, set a password to track your bookings, pay any balance and get trip updates.</p>
          <div className="mt-6 rounded-[1.75rem] border border-line bg-white p-6"><AccountSetupForm token={token} login={c.email ?? `+91 ${c.phone}`} /></div>
        </>
      ) : (
        <>
          <p className="mt-2 text-muted">This link has expired or your account is already set up.</p>
          <Link href="/login?next=/account" className="press mt-6 inline-block rounded-full bg-ink px-6 py-3 font-extrabold text-white">Log in to My Bookings</Link>
        </>
      )}
    </section>
  );
}
