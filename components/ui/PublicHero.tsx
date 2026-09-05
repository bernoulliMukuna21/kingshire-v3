import { cn } from "@/lib/utils";

type Props = {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
};

export default function PublicHero({
  eyebrow,
  title,
  description,
  children,
  className,
}: Props) {
  return (
    <section
      className={cn(
        "relative overflow-hidden bg-[#10234b] px-4 pb-12 pt-24 text-white sm:px-6 sm:pb-16",
        className,
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,0.22),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.3),transparent_34%)]" />
      <div className="relative mx-auto max-w-6xl">
        {eyebrow && (
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-sky-300">
            {eyebrow}
          </p>
        )}
        <h1 className="text-3xl font-black tracking-tight md:text-5xl">
          {title}
        </h1>
        {description && (
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/65 sm:text-base">
            {description}
          </p>
        )}
        {children && <div className="mt-8">{children}</div>}
      </div>
    </section>
  );
}
