import { Header } from "@/components/Header";
import { Footer, WhatsAppButton } from "@/components/Footer";
import { LeadDialog } from "@/components/LeadDialog";
import { CustomTripDialog } from "@/components/CustomTripDialog";
import { getDestinationsWithTrips, getPublishedPageSlugs } from "@/lib/queries";
import { legalLinks } from "@/lib/site";
import { getNav } from "@/lib/nav";
import { getSettings } from "@/lib/settings";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [settings, nav, dests, published] = await Promise.all([getSettings(), getNav(), getDestinationsWithTrips(), getPublishedPageSlugs()]);
  return (
    <>
      <Header settings={settings} nav={nav} />
      <main className="flex-1">{children}</main>
      <Footer settings={settings} nav={nav} legal={legalLinks.filter((l) => published.has(l.href.slice(1)))} />
      <WhatsAppButton number={settings.whatsapp} />
      <LeadDialog />
      <CustomTripDialog destinations={dests.map((d) => d.name)} whatsapp={settings.whatsapp} />
    </>
  );
}
