import { Header } from "@/components/Header";
import { Footer, WhatsAppButton } from "@/components/Footer";
import { LeadDialog } from "@/components/LeadDialog";
import { CustomTripDialog } from "@/components/CustomTripDialog";
import { getDestinationsWithTrips } from "@/lib/queries";
import { getNav } from "@/lib/nav";
import { getSettings } from "@/lib/settings";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [settings, nav, dests] = await Promise.all([getSettings(), getNav(), getDestinationsWithTrips()]);
  return (
    <>
      <Header settings={settings} nav={nav} />
      <main className="flex-1">{children}</main>
      <Footer settings={settings} nav={nav} />
      <WhatsAppButton number={settings.whatsapp} />
      <LeadDialog />
      <CustomTripDialog destinations={dests.map((d) => d.name)} whatsapp={settings.whatsapp} />
    </>
  );
}
