import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  return (
    <footer className="bg-[#0f172a] text-white/40 py-10 px-6">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm">
        <div className="flex items-center gap-2">
          <Image
            src="/logo.png"
            alt="KingsHire"
            width={110}
            height={32}
            className="h-7 w-auto opacity-50"
          />
        </div>
        <p>© 2026 KingsHire. Community-first platform.</p>
        <div className="flex gap-6">
          <Link href="/plan" className="hover:text-white/70 transition-colors">
            Build Plan
          </Link>
          <Link href="#" className="hover:text-white/70 transition-colors">
            Privacy
          </Link>
          <Link href="#" className="hover:text-white/70 transition-colors">
            Terms
          </Link>
        </div>
      </div>
    </footer>
  );
}
