import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminDb } from "@/lib/admin/access";
import { collectPages } from "@/lib/db/pagination";
import { coerceNumeric } from "@/lib/db/coerce";
import { adminMoney } from "@/components/admin/AdminMoney";
import { transactionStatusPill } from "@/lib/transactions";
export default async function AdminPaymentDetail({
  params,
}: {
  params: Promise<{ ledger: string; id: string }>;
}) {
  const db = await getAdminDb();
  const { ledger, id } = await params;
  if (
    !["transactions", "engagement_payments"].includes(ledger) ||
    !/^[0-9a-f-]{36}$/i.test(id)
  )
    notFound();
  const result =
    ledger === "transactions"
      ? await db.from("transactions").select("*").eq("id", id).maybeSingle()
      : await db
          .from("engagement_payments")
          .select("*")
          .eq("id", id)
          .maybeSingle();
  if (result.error) throw new Error("Payment record unavailable");
  if (!result.data) notFound();
  const raw = result.data;
  const row = coerceNumeric(raw, [
    "platform_fee_client",
    "platform_fee_kinglancer",
  ]);
  const gross =
    "amount" in row
      ? coerceNumeric(row, ["amount"]).amount
      : coerceNumeric(row, ["worker_amount"]).worker_amount;
  const [profile, audit] = await Promise.all([
    db
      .from("profiles")
      .select("full_name,email")
      .eq("id", row.kinglancer_id)
      .maybeSingle(),
    collectPages((from, to) =>
      db
        .from("settlement_recovery_audit")
        .select("id,action,reason,actor_id,created_at")
        .eq("payment_id", id)
        .eq("ledger", ledger)
        .order("created_at", { ascending: false })
        .order("id")
        .range(from, to),
    ),
  ]);
  let title = "Payment";
  let contextHref = "/admin/jobs";
  if ("job_id" in row) {
    const job = await db
      .from("jobs")
      .select("title")
      .eq("id", row.job_id)
      .maybeSingle();
    title = job.data?.title ?? title;
    contextHref = `/jobs/${row.job_id}`;
  } else {
    const engagement = await db
      .from("engagements")
      .select("source_kind,source_id")
      .eq("id", row.engagement_id)
      .maybeSingle();
    if (engagement.data?.source_kind === "org_role") {
      const job = await db
        .from("jobs")
        .select("title")
        .eq("id", engagement.data.source_id)
        .maybeSingle();
      title = job.data?.title ?? "Role payment";
      contextHref = `/jobs/${engagement.data.source_id}`;
    } else title = "Placement payment";
  }
  const status = transactionStatusPill(row.status);
  return (
    <div className="space-y-6">
      <Link
        href={`/admin/finance?tab=history&ledger=${ledger}`}
        className="text-sm text-blue-700"
      >
        ← Payment history
      </Link>
      <div>
        <h1 className="text-2xl font-black">{title}</h1>
        <p className="mt-2 break-all text-xs text-slate-500">{id}</p>
      </div>
      <section className="space-y-5 rounded-2xl border border-slate-100 bg-white p-6">
        <div className="flex flex-wrap justify-between gap-3">
          <div>
            <h2 className="font-bold">{profile.data?.full_name ?? "Worker"}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {profile.error
                ? "Worker details unavailable"
                : profile.data?.email}
            </p>
          </div>
          <span
            className={`self-start rounded-full px-3 py-1 text-xs ${status.className}`}
          >
            {status.label}
          </span>
        </div>
        <dl className="grid gap-5 sm:grid-cols-3">
          {[
            { label: "Gross worker allocation", value: adminMoney(gross) },
            {
              label: "Worker fee",
              value: adminMoney(row.platform_fee_kinglancer),
            },
            {
              label: "Worker net",
              value: adminMoney(
                gross === 0 ? 0 : gross - row.platform_fee_kinglancer,
              ),
            },
          ].map((item) => (
            <div key={item.label}>
              <dt className="text-xs text-slate-500">{item.label}</dt>
              <dd className="mt-1 text-xl font-bold">{item.value}</dd>
            </div>
          ))}
        </dl>
        <div className="space-y-2 break-all text-xs text-slate-600">
          <p>
            Stripe funding: {row.stripe_payment_intent_id ?? "None recorded"}
          </p>
          <p>Stripe transfer: {row.stripe_transfer_id ?? "None recorded"}</p>
          <p>Refund: {row.stripe_refund_id ?? "None recorded"}</p>
          {"manual_payout_reference" in row && (
            <p>
              External payout reference:{" "}
              {row.manual_payout_reference ?? "None recorded"}
            </p>
          )}
          <p>Settlement: {row.release_outcome ?? "No attempt in progress"}</p>
          {row.settlement_error && (
            <p className="text-amber-800">{row.settlement_error}</p>
          )}
        </div>
        <Link
          className="inline-block text-sm font-semibold text-blue-700"
          href={contextHref}
        >
          View work context →
        </Link>
        {row.release_attempt_id && row.release_outcome !== "succeeded" && (
          <Link
            href={`/admin/settlements#${id}`}
            className="ml-4 text-sm font-semibold text-amber-800"
          >
            Review payment issue →
          </Link>
        )}
      </section>
      <section>
        <h2 className="mb-3 text-lg font-bold">Recorded timeline</h2>
        <p className="mb-3 text-sm text-slate-500">
          Payment created{" "}
          {new Date(row.created_at).toLocaleString("en-GB", {
            timeZone: "Europe/London",
          })}
          .{" "}
          {row.released_at
            ? `Released ${new Date(row.released_at).toLocaleString("en-GB", { timeZone: "Europe/London" })}.`
            : "No release recorded."}
        </p>
        {audit.length ? (
          audit.map((event) => (
            <div
              key={event.id}
              className="mb-3 rounded-xl border border-slate-100 bg-white p-5"
            >
              <p className="font-semibold">{event.action}</p>
              <p className="mt-2 text-sm text-slate-600">{event.reason}</p>
              <p className="mt-2 text-xs text-slate-400">
                {new Date(event.created_at).toLocaleString("en-GB", {
                  timeZone: "Europe/London",
                })}{" "}
                · Actor {event.actor_id}
              </p>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-500">
            No recovery or correction events recorded for this payment.
          </p>
        )}
      </section>
    </div>
  );
}
