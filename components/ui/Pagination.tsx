import { ButtonLink } from "@/components/ui/Button";

type Props = {
  basePath: string;
  page: number;
  total: number;
  pageSize: number;
  itemLabel?: string;
  /** Extra query params to preserve in pagination links (e.g. search query). */
  params?: Record<string, string>;
};

function pageHref(
  basePath: string,
  page: number,
  extra?: Record<string, string>,
) {
  const p = new URLSearchParams({ ...extra, page: String(page) });
  return `${basePath}?${p}`;
}

export default function Pagination({
  basePath,
  page,
  total,
  pageSize,
  itemLabel = "records",
  params,
}: Props) {
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  const previousPage = page - 1;
  const nextPage = page + 1;

  if (totalPages <= 1) {
    return (
      <div className="border-t border-gray-50 px-5 py-4 text-xs font-semibold text-slate-400 sm:px-6">
        Showing all {total} {itemLabel}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 border-t border-gray-50 px-5 py-4 sm:px-6">
      {previousPage >= 1 ? (
        <ButtonLink
          href={pageHref(basePath, previousPage, params)}
          variant="secondary"
          size="sm"
        >
          Previous
        </ButtonLink>
      ) : (
        <span />
      )}

      <p className="text-xs font-semibold text-slate-400">
        Page {page} of {totalPages}
      </p>

      {nextPage <= totalPages ? (
        <ButtonLink href={pageHref(basePath, nextPage, params)} size="sm">
          Next
        </ButtonLink>
      ) : (
        <span />
      )}
    </div>
  );
}
