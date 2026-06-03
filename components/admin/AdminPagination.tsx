import Pagination from "@/components/ui/Pagination";

type Props = {
  basePath: string;
  page: number;
  total: number;
  pageSize: number;
};

export default function AdminPagination({
  basePath,
  page,
  total,
  pageSize,
}: Props) {
  return (
    <Pagination
      basePath={basePath}
      page={page}
      total={total}
      pageSize={pageSize}
    />
  );
}
