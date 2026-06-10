"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Card } from "@/components/ui/Card";

type Service = {
  name: string;
  rate: number | string;
  rate_type: string;
};

const VISIBLE_COUNT = 3;

export default function ServicesSection({ services }: { services: Service[] }) {
  const [expanded, setExpanded] = useState(false);

  if (!services.length) return null;

  const visible = expanded ? services : services.slice(0, VISIBLE_COUNT);
  const hiddenCount = services.length - VISIBLE_COUNT;

  return (
    <Card className="p-6">
      <h2 className="text-lg font-black text-slate-950">Services</h2>
      <div className="mt-4 divide-y divide-slate-100">
        {visible.map((service, index) => {
          const serviceRate = Number(service.rate);
          return (
            <div
              key={`${service.name}-${index}`}
              className="flex items-center justify-between gap-4 py-3"
            >
              <p className="text-sm font-bold text-slate-800">{service.name}</p>
              <p className="text-sm font-black text-green-700">
                {serviceRate > 0 ? (
                  <>
                    £{serviceRate.toLocaleString()}{" "}
                    <span className="font-semibold text-slate-400">
                      {service.rate_type.replace("_", " ")}
                    </span>
                  </>
                ) : (
                  "Discuss"
                )}
              </p>
            </div>
          );
        })}
      </div>

      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2 text-sm font-bold text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
        >
          {expanded ? (
            <>
              <ChevronUp size={15} />
              Show less
            </>
          ) : (
            <>
              <ChevronDown size={15} />
              {hiddenCount} more service{hiddenCount !== 1 ? "s" : ""}
            </>
          )}
        </button>
      )}
    </Card>
  );
}
