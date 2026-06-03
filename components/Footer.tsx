import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  return (
    <footer className="bg-[#10234b] px-6 py-8 text-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 text-center sm:flex-row sm:justify-between sm:text-left">
        <Link href="/" className="inline-flex items-center">
          <Image
            src="/logo.png"
            alt="KingsHire"
            width={137}
            height={36}
            className="h-8 w-auto brightness-0 invert opacity-85"
          />
        </Link>

        <div className="space-y-3 sm:text-right">
          <p className="text-sm text-white/45">
            © 2026 KingsHire. Community-first platform.
          </p>
          <div className="flex justify-center gap-5 text-sm font-semibold text-white/65 sm:justify-end">
            <Link href="/privacy" className="transition-colors hover:text-white">
              Privacy
            </Link>
            <Link href="/terms" className="transition-colors hover:text-white">
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
