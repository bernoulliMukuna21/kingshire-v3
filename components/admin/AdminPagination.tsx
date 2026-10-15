import Pagination from "@/components/ui/Pagination";

type Props = {
  basePath: string;
  page: number;
  total: number;
  pageSize: number;
  params?: Record<string, string>;
};

export default function AdminPagination({
  basePath,
  page,
  total,
  pageSize,
  params,
}: Props) {
  return (
    <Pagination
      basePath={basePath}
      page={page}
      total={total}
      pageSize={pageSize}
      params={params}
    />
  );
}
