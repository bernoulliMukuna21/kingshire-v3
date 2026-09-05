"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { CheckCircle } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import OrganisationSetupShell from "@/components/organisations/OrganisationSetupShell";

export type AuthImage = {
  src: string;
  alt: string;
};

interface AuthLayoutProps {
  headline: string;
  accent: string;
  body: string;
  bullets?: string[];
  imageSrc?: string;
  imageAlt?: string;
  images?: readonly AuthImage[];
  imagePlaceholder?: string;
  children: React.ReactNode;
  organisationSetup?: boolean;
}

export default function AuthLayout({
  headline,
  accent,
  body,
  bullets,
  imageSrc,
  imageAlt = "",
  images,
  children,
  organisationSetup = false,
  imagePlaceholder,
}: AuthLayoutProps) {
  const prefersReducedMotion = useReducedMotion();
  const [activeImage, setActiveImage] = useState(0);
  const [loadedImages, setLoadedImages] = useState<Set<number>>(
    () => new Set(),
  );
  const [failedImages, setFailedImages] = useState<Set<number>>(
    () => new Set(),
  );
  const imageList =
    images && images.length > 0
      ? images
      : imageSrc
        ? [{ src: imageSrc, alt: imageAlt }]
        : [];

  useEffect(() => {
    if (
      prefersReducedMotion ||
      imageList.length < 2 ||
      !loadedImages.has(activeImage)
    )
      return;
    const interval = window.setInterval(
      () =>
        setActiveImage((current) => {
          for (let offset = 1; offset <= imageList.length; offset += 1) {
            const candidate = (current + offset) % imageList.length;
            if (!failedImages.has(candidate)) return candidate;
          }
          return current;
        }),
      6000,
    );
    return () => window.clearInterval(interval);
  }, [
    activeImage,
    failedImages,
    imageList.length,
    loadedImages,
    prefersReducedMotion,
  ]);

  if (organisationSetup) {
    return (
      <OrganisationSetupShell currentStep="account">
        <div className="mx-auto w-full max-w-xl">{children}</div>
      </OrganisationSetupShell>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Left panel */}
      <div className="relative hidden overflow-hidden bg-[#10234b] p-12 lg:flex lg:w-1/2 lg:flex-col lg:justify-between">
        {imageList.length > 0 ? (
          <>
            {imageList.map((image, index) => (
              <Image
                key={image.src}
                src={image.src}
                alt={index === activeImage ? image.alt : ""}
                fill
                sizes="50vw"
                className={`object-cover transition-opacity duration-1000 ${
                  index === activeImage ? "opacity-100" : "opacity-0"
                }`}
                preload={index === 0}
                unoptimized
                placeholder={imagePlaceholder ? "blur" : undefined}
                blurDataURL={imagePlaceholder}
                onLoad={() =>
                  setLoadedImages((current) => new Set(current).add(index))
                }
                onError={() => {
                  setFailedImages((current) => new Set(current).add(index));
                  if (index === activeImage) {
                    setActiveImage((index + 1) % imageList.length);
                  }
                }}
              />
            ))}
            <div className="absolute inset-0 bg-linear-to-t from-[#10234b] via-[#10234b]/72 to-[#10234b]/18" />
          </>
        ) : (
          <div className="absolute inset-0 bg-linear-to-br from-[#0f172a] via-[#1e3a7a] to-[#0f172a]" />
        )}

        <div className="relative z-10">
          <Link href="/" className="flex items-center">
            <Image
              src="/logo.png"
              alt="KingsHire"
              width={140}
              height={40}
              className="h-9 w-auto brightness-0 invert"
              priority
            />
          </Link>
        </div>

        <div className="relative z-10">
          <h2 className="mb-4 text-4xl font-extrabold leading-tight tracking-tight text-white">
            {headline}
            <br />
            <span className="text-blue-400">{accent}</span>
          </h2>
          <p className="text-white/50 text-lg leading-relaxed">{body}</p>
          {bullets && (
            <div className="mt-8 space-y-3">
              {bullets.map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-3 text-white/70 text-sm"
                >
                  <CheckCircle size={16} className="text-green-400 shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="relative z-10 text-white/20 text-sm">© 2026 KingsHire</p>
      </div>

      {/* Right panel */}
      <div className="flex min-h-screen flex-1 overflow-y-auto p-6">
        <div className="m-auto flex w-full justify-center">{children}</div>
      </div>
    </div>
  );
}
