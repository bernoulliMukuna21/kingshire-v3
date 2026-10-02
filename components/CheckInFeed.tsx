type CheckInEntry = {
  id: string;
  authorId: string;
  authorName: string | null;
  note: string;
  createdAt: string;
};

/** Shared check-in list for any engagement-like agreement (placement or
 * role) — labels each entry by whether its author is the participant. */
export default function CheckInFeed({
  checkIns,
  kinglancerId,
}: {
  checkIns: CheckInEntry[];
  kinglancerId: string;
}) {
  if (!checkIns.length) {
    return <p className="text-sm text-slate-500">No check-ins yet.</p>;
  }
  return (
    <div className="space-y-3">
      {checkIns.map((c) => {
        const fromKinglancer = c.authorId === kinglancerId;
        return (
          <div key={c.id} className="rounded-xl bg-slate-50 p-3">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-700">
                {c.authorName ?? "Someone"}
                <span className="ml-1.5 rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
                  {fromKinglancer ? "Kinglancer" : "Organisation"}
                </span>
              </span>
              <span className="text-xs text-slate-400">
                {new Date(c.createdAt).toLocaleString("en-GB")}
              </span>
            </div>
            <p className="whitespace-pre-wrap text-sm text-slate-700">
              {c.note}
            </p>
          </div>
        );
      })}
    </div>
  );
}
