import Link from "next/link";

export default function NotFound() {
  return (
    <section className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 py-24 text-center">
      <p className="text-7xl" aria-hidden>🧭</p>
      <h1 className="display mt-6 text-4xl sm:text-5xl">This trail doesn&apos;t exist.</h1>
      <p className="mt-4 text-lg text-muted">The page may have moved. Let&apos;s get you back on the road.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="press rounded-full bg-brand px-6 py-3 font-extrabold text-white">Go home</Link>
        <Link href="/upcoming-trips" className="press rounded-full border border-line px-6 py-3 font-extrabold">See upcoming trips</Link>
      </div>
    </section>
  );
}
