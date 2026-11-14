import { redirect } from "next/navigation";
import { getOpsUser } from "@/lib/ops-auth";
import { THEME } from "@/app/ops/(app)/accent";
import { LoginForm } from "./LoginForm";
import { logout } from "./actions";

export default async function OpsLogin({ searchParams }: PageProps<"/ops/login">) {
  if ((await getOpsUser()) && (await searchParams).error !== "nobiz") redirect("/ops");
  const noBiz = (await searchParams).error === "nobiz";
  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-[#120e0c] px-4">
      {/* Both brands' colours meet here, because this door opens onto either business */}
      <span aria-hidden className="pointer-events-none absolute inset-0 opacity-25"
        style={{ background: `radial-gradient(60% 50% at 15% 0%, ${THEME.td.acc}, transparent 70%), radial-gradient(60% 50% at 85% 100%, ${THEME.finzo.acc}, transparent 70%)` }} />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2.5">
          <span className="flex" style={{ "--td": THEME.td.acc, "--fs": THEME.finzo.acc } as React.CSSProperties}>
            <span className="grid size-8 place-items-center rounded-l-[10px] bg-[var(--td)] text-[11px] font-bold text-white">TD</span>
            <span className="grid size-8 place-items-center rounded-r-[10px] bg-[var(--fs)] text-[11px] font-bold text-white">FS</span>
          </span>
          <span className="leading-tight"><span className="block text-sm font-semibold text-white">Back office</span><span className="block text-[10px] uppercase tracking-[0.14em] text-zinc-500">Travel Devils · Finzo Stays</span></span>
        </div>
        <h1 className="mb-1 text-[26px] font-extrabold tracking-[-0.025em] text-white">Sign in</h1>
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
