import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCustomer } from "@/lib/customer-auth";
import { LoginCard } from "@/components/booking/LoginCard";

export const metadata: Metadata = { title: "Log in", robots: { index: false } };

export default async function Login({ searchParams }: PageProps<"/login">) {
  const raw = (await searchParams).next;
  // only allow same-site relative paths (no open redirects)
  const next = typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/account";
  if (await getCustomer()) redirect(next);
  return <LoginCard title="Log in" next={next} />;
}
