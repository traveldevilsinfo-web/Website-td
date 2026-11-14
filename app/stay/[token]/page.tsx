import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarDays, Check, DoorOpen, KeyRound, MapPin, Wifi } from "lucide-react";
import { addDays, dateDay } from "@/lib/format";
import { istToday } from "@/lib/ops-rules";
import { openStayLink } from "@/lib/stay-link";
import { nights } from "@/lib/stays";
import { guestStage } from "@/lib/stays-guests";
import { CheckinForm } from "./CheckinForm";

// A link anyone with the URL can open: never indexed, and the door code only after check-in.
export const metadata: Metadata = { title: { absolute: "Your stay · Finzo Stays" }, robots: { index: false, follow: false } };
// Rendered fresh every time: a cached copy would keep handing out the door code after the stay ends or is cancelled.
export const dynamic = "force-dynamic";

const DEFAULT_RULES = `No parties or events, and no loud music after 10 pm.
No smoking indoors.
Please don't bring extra guests who aren't on the booking.
Treat the flat and the neighbours with care; damage is charged at cost.
Lock up and close the windows whenever you go out.`;

const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <section className={`rounded-2xl border border-zinc-200 bg-white p-5 ${className}`}>{children}</section>
);
const Row = ({ icon: Icon, label, children }: { icon: typeof Wifi; label: string; children: React.ReactNode }) => (
  <div className="flex items-start gap-3 py-2.5">
    <Icon className="mt-0.5 size-5 shrink-0 text-emerald-700" aria-hidden />
    <div className="min-w-0"><p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p><div className="text-[15px] text-zinc-900">{children}</div></div>
  </div>
);

export default async function GuestStayPage({ params }: PageProps<"/stay/[token]">) {
  const hit = await openStayLink((await params).token);
  if (!hit) notFound();
  const { p, r } = hit;
  const today = istToday();
  const stage = r ? guestStage({ ...r, status: r.status }, today) : "guide";
  const rules = p.houseRules?.trim() || DEFAULT_RULES;
  const guide = p.guide.filter((g) => g.title.trim() || g.body.trim());

  return (
    <main className="mx-auto min-h-screen max-w-xl bg-zinc-50 px-4 py-8 sm:px-6">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Finzo Stays</p>
        <h1 className="mt-1 text-2xl font-bold leading-tight tracking-[-0.02em] text-zinc-900">{p.name}</h1>
        {r && <p className="mt-1 text-sm text-zinc-600">{dateDay(r.checkIn)} → {dateDay(r.checkOut)} · {nights(r.checkIn, r.checkOut)} nights</p>}
      </header>

      {stage === "cancelled" && <Card><p className="text-[15px] text-zinc-700">This booking isn&apos;t active any more. If that&apos;s a surprise, please contact us on the site you booked through.</p></Card>}

      {stage === "over" && (
        <Card>
          <h2 className="text-lg font-semibold">Thank you for staying with us</h2>
          <p className="mt-1.5 text-[15px] leading-relaxed text-zinc-600">We hope you enjoyed {p.name}. If you have a minute, a review really helps our small team.</p>
        </Card>
      )}

      {stage === "checkin" && r && (
        <>
          <Card className="mb-5 border-emerald-200 bg-emerald-50/60">
            <h2 className="text-lg font-semibold text-emerald-950">Check in before you arrive</h2>
            <p className="mt-1.5 text-[15px] leading-relaxed text-emerald-900/80">Takes a minute. Once it&apos;s done, your door code and Wi-Fi appear on this page.</p>
          </Card>
          <Card><CheckinForm token={r.guestToken} guestName={r.guestName} guests={r.guests} rules={rules} /></Card>
        </>
      )}

      {(stage === "ready" || stage === "soon" || stage === "guide") && (
        <div className="space-y-4">
          {stage !== "guide" && (
            <p className="flex items-start gap-2 rounded-2xl bg-emerald-700 px-5 py-4 text-[15px] font-semibold text-white">
              <Check className="mt-0.5 size-5 shrink-0" aria-hidden />
              {stage === "ready" ? "You're checked in. Here's everything you need."
                : `You're checked in. Your door code appears here on ${dateDay(addDays(r!.checkIn, -1))}, the day before you arrive.`}
            </p>
          )}
          <Card>
            <div className="divide-y divide-zinc-100">
              {stage === "ready" && p.lockCode && (
                <Row icon={KeyRound} label="Door code"><span className="font-mono text-3xl font-bold tracking-[0.12em] text-zinc-900">{p.lockCode}</span></Row>
              )}
              {p.wifiName && (
                <Row icon={Wifi} label="Wi-Fi">
                  <span className="font-medium">{p.wifiName}</span>
                  {p.wifiPass && <span className="mt-0.5 block font-mono text-lg tracking-wide">{p.wifiPass}</span>}
                </Row>
              )}
              {stage !== "guide" && p.address && <Row icon={MapPin} label="Address">{p.address}</Row>}
              <Row icon={CalendarDays} label="Check-in / check-out">From {p.checkinTime} · by {p.checkoutTime}</Row>
              {stage !== "guide" && r && <Row icon={DoorOpen} label="Checked in as">{r.agreedName}</Row>}
            </div>
          </Card>

          {guide.map((g, i) => (
            <Card key={i}>
              <h2 className="text-[15px] font-semibold text-zinc-900">{g.title}</h2>
              <p className="mt-1.5 whitespace-pre-line text-[15px] leading-relaxed text-zinc-600">{g.body}</p>
            </Card>
          ))}

          <Card>
            <h2 className="text-[15px] font-semibold text-zinc-900">House rules</h2>
            <p className="mt-1.5 whitespace-pre-line text-[15px] leading-relaxed text-zinc-600">{rules}</p>
          </Card>
        </div>
      )}

      <p className="mt-8 text-center text-xs text-zinc-400">Finzo Stays · keep this link, it&apos;s just for you</p>
    </main>
  );
}
