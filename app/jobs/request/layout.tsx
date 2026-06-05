import PublicShell from "@/components/ui/PublicShell";

export default function RequestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PublicShell withFooter={false} navbarVariant="solid">
      {children}
    </PublicShell>
  );
}
