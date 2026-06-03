import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-blue-600 text-white shadow-lg shadow-blue-500/25 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-500/30",
  secondary:
    "border border-slate-200 bg-white text-slate-800 shadow-sm hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50/60 hover:text-blue-700",
  ghost:
    "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
  danger:
    "bg-red-500 text-white shadow-lg shadow-red-500/25 hover:-translate-y-0.5 hover:bg-red-600 hover:shadow-xl hover:shadow-red-500/30",
};

const sizeClasses: Record<Size, string> = {
  sm: "px-3.5 py-2 text-xs",
  md: "px-5 py-2.5 text-sm",
  lg: "px-6 py-3 text-base",
};

const baseClasses =
  "inline-flex items-center justify-center gap-2 rounded-2xl font-bold transition-all duration-200 active:translate-y-0 disabled:pointer-events-none disabled:opacity-50";

type SharedProps = {
  children: ReactNode;
  className?: string;
  variant?: Variant;
  size?: Size;
};

type ButtonProps = SharedProps & ComponentPropsWithoutRef<"button">;
type ButtonLinkProps = SharedProps & ComponentPropsWithoutRef<typeof Link>;

export function buttonClasses({
  className,
  variant = "primary",
  size = "md",
}: {
  className?: string;
  variant?: Variant;
  size?: Size;
} = {}) {
  return cn(baseClasses, variantClasses[variant], sizeClasses[size], className);
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={buttonClasses({ className, variant, size })}
      {...props}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  className,
  variant = "primary",
  size = "md",
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link className={buttonClasses({ className, variant, size })} {...props}>
      {children}
    </Link>
  );
}
