import Link from "next/link";
import { getAdminDb } from "@/lib/admin/access";
import { deriveEnquiryView, enquiryStatuses } from "@/lib/support/view";
import { getPageNumber, getPageRange } from "@/lib/pagination";
import EnquiryStatus from "./EnquiryStatus";
export default async function SupportInbox({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const db = await getAdminDb();
  const params = await searchParams;
  const status =
    enquiryStatuses.find((value) => value === params.status) ?? "new";
  const page = getPageNumber(params.page);
  const { from, to } = getPageRange(page, 20);
  const result = await db
    .from("support_enquiries")
    .select(
      "id,topic,status,name,email,organisation,reference,message,source_path,created_at",
      { count: "exact" },
    )
    .eq("status", status)
    .order("created_at", { ascending: false })
    .order("id")
    .range(from, to);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black">Customer enquiries</h1>
        <p className="mt-2 text-sm text-slate-500">
          Help requests and demo enquiries from the platform. Reply by email,
          then update the status here.
        </p>
      </div>
      <p className="text-sm text-slate-500">
        New feedback is collected separately in{" "}
        <a
          href="https://tally.so/dashboard"
          className="font-semibold text-blue-600"
        >
          Tally
        </a>
        .
      </p>
      <nav aria-label="Enquiry filters" className="flex flex-wrap gap-2">
        {enquiryStatuses.map((value) => (
          <Link
            key={value}
            href={`/admin/support?status=${value}`}
            aria-current={status === value ? "page" : undefined}
            className={`rounded-xl px-4 py-2 text-sm font-semibold ${status === value ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600"}`}
          >
            {deriveEnquiryView("account", value).statusLabel}
          </Link>
        ))}
      </nav>
      {result.error ? (
        <p role="alert" className="rounded-2xl bg-amber-50 p-6 text-amber-900">
          The inbox couldn’t load. Please refresh or check the support email
          inbox.
        </p>
      ) : !result.data?.length ? (
        <div className="rounded-2xl border border-slate-100 bg-white p-8">
          <h2 className="font-bold">No enquiries in this list</h2>
          <p className="mt-2 text-sm text-slate-500">
            Messages sent through the help and demo request forms will appear
            here.
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-slate-500">
            {result.count} {result.count === 1 ? "enquiry" : "enquiries"}
          </p>
          {result.data.map((row) => (
            <article
              key={row.id}
              id={row.id}
              className="scroll-mt-6 rounded-2xl border border-slate-100 bg-white p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-blue-600">
                    {deriveEnquiryView(row.topic).label}
                  </p>
                  <h2 className="mt-2 text-lg font-bold">
                    {row.name || "Anonymous feedback"}
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    {new Date(row.created_at).toLocaleString("en-GB", {
                      timeZone: "Europe/London",
                    })}{" "}
                    · {row.id.slice(0, 8).toUpperCase()}
                  </p>
                </div>
                <EnquiryStatus id={row.id} status={row.status} />
              </div>
              {row.organisation && (
                <p className="mt-3 text-sm text-slate-600">
                  Organisation: {row.organisation}
                </p>
              )}
              {row.reference && (
                <p className="mt-3 break-words text-sm text-slate-600">
                  Job or payment reference: {row.reference}
                </p>
              )}
              <p className="mt-5 whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">
                {row.message}
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                {row.email ? (
                  <a
                    href={`mailto:${row.email}?subject=${encodeURIComponent(`KingsHire · ${deriveEnquiryView(row.topic).label} · ${row.id.slice(0, 8).toUpperCase()}`)}`}
                    className="break-all text-sm font-semibold text-blue-600"
                  >
                    Reply to {row.email} →
                  </a>
                ) : (
                  <p className="text-sm text-slate-500">
                    No reply email provided
                  </p>
                )}
                {row.source_path && (
                  <p className="max-w-full break-all text-xs text-slate-400">
                    Sent from: {row.source_path}
                  </p>
                )}
              </div>
            </article>
          ))}
          <nav
            aria-label="Inbox pages"
            className="flex justify-between text-sm font-semibold text-blue-600"
          >
            {page > 1 ? (
              <Link href={`/admin/support?status=${status}&page=${page - 1}`}>
                ← Previous
              </Link>
            ) : (
              <span />
            )}
            {(result.count ?? 0) > to + 1 && (
              <Link href={`/admin/support?status=${status}&page=${page + 1}`}>
                Next →
              </Link>
            )}
          </nav>
        </>
      )}
    </div>
  );
}
