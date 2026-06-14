import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <p className="text-6xl font-black text-[#10234b] mb-4">404</p>
        <h1 className="text-2xl font-black text-slate-950 mb-2">
          Page not found
        </h1>
        <p className="text-slate-500 mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-2xl bg-[#10234b] px-6 py-3 text-sm font-bold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:bg-[#1a3a6e]"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
