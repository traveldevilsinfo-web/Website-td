import { Header } from "@/components/Header";
import { Footer, WhatsAppButton } from "@/components/Footer";
import { LeadDialog } from "@/components/LeadDialog";
import { getNav } from "@/lib/nav";
import { getSettings } from "@/lib/settings";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [settings, nav] = await Promise.all([getSettings(), getNav()]);
  return (
    <>
      <Header settings={settings} nav={nav} />
      <main className="flex-1">{children}</main>
      <Footer settings={settings} nav={nav} />
      <WhatsAppButton number={settings.whatsapp} />
      <LeadDialog />
    </>
  );
}
