import { redirect } from "next/navigation";
import { getOpsUser } from "@/lib/ops-auth";
import { LoginForm } from "./LoginForm";
import { logout } from "./actions";

export default async function OpsLogin({ searchParams }: PageProps<"/ops/login">) {
  if ((await getOpsUser()) && (await searchParams).error !== "nobiz") redirect("/ops");
  const noBiz = (await searchParams).error === "nobiz";
  return (
    <div className="grid min-h-screen place-items-center bg-[#0c0e12] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2.5">
          <span className="flex">
            <span className="grid size-8 place-items-center rounded-l-md bg-[#e5484d] text-[11px] font-bold text-white">TD</span>
            <span className="grid size-8 place-items-center rounded-r-md bg-[#12a594] text-[11px] font-bold text-white">FS</span>
          </span>
          <span className="leading-tight"><span className="block text-sm font-semibold text-white">Back office</span><span className="block text-[10px] uppercase tracking-[0.14em] text-zinc-500">Travel Devils · Finzo Stays</span></span>
        </div>
        <h1 className="mb-1 text-xl font-semibold text-white">Sign in</h1>
        <p className="mb-6 text-sm text-zinc-400">Expenses, fixed costs and team.</p>
        {noBiz ? (
          <div className="space-y-4">
            <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">Your account isn&apos;t linked to a business yet. Ask the owner to tick one for you.</p>
            <form action={logout}><button className="w-full rounded-md border border-white/20 py-2.5 text-sm font-semibold text-white hover:bg-white/5">Sign out</button></form>
          </div>
        ) : <LoginForm />}
      </div>
    </div>
  );
}
