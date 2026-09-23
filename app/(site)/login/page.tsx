import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCustomer } from "@/lib/customer-auth";
import { getSettings } from "@/lib/settings";
import { getDestinationsWithTrips } from "@/lib/queries";
import { LoginCard } from "@/components/booking/LoginCard";

export const metadata: Metadata = { title: "Log in", robots: { index: false } };

export default async function Login({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  // only allow same-site relative paths (no open redirects)
  const next = typeof sp.next === "string" && sp.next.startsWith("/") && !sp.next.startsWith("//") ? sp.next : "/account";
  if (await getCustomer()) redirect(next);
  const [settings, dests] = await Promise.all([getSettings(), getDestinationsWithTrips()]);
  const image = settings.heroSlides[0]?.image ?? dests.find((d) => d.heroImage || d.cover)?.heroImage ?? dests.find((d) => d.cover)?.cover ?? null;
  const travellers = settings.stats.find((s) => /travell?er/i.test(s.label))?.value ?? null;
  return <LoginCard next={next} whatsapp={settings.whatsapp} image={image} travellers={travellers} mode={sp.mode === "register" ? "register" : "login"} />;
}
