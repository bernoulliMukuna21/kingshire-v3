import { getInitials, cn } from "@/lib/utils";

type Props = {
  name: string | null | undefined;
  src?: string | null;
  className?: string;
  tone?: "blue" | "green" | "red";
};

const toneClasses = {
  blue: "from-blue-500 to-indigo-600",
  green: "from-green-500 to-emerald-600",
  red: "from-rose-500 to-orange-500",
};

export function Avatar({ name, src, className, tone = "blue" }: Props) {
  return (
    <div
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-linear-to-br text-sm font-black text-white shadow-lg shadow-slate-900/10",
        toneClasses[tone],
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        getInitials(name)
      )}
    </div>
  );
}
