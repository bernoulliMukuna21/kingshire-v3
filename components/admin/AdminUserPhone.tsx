export default function AdminUserPhone({ phone }: { phone: string | null }) {
  const number = phone?.trim();

  return (
    <p className="mt-1 text-xs text-gray-500">
      Phone: {number ? (
        <a
          href={`tel:${number}`}
          className="break-all text-blue-700 underline underline-offset-2 hover:text-blue-900"
        >
          {number}
        </a>
      ) : (
        "Not provided"
      )}
    </p>
  );
}
