import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function PublicShell({
  children,
  withFooter = true,
  navbarVariant = "transparent",
}: {
  children: React.ReactNode;
  withFooter?: boolean;
  navbarVariant?: "transparent" | "solid";
}) {
  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-slate-50">
      <Navbar variant={navbarVariant} />
      <main className="flex-1">{children}</main>
      {withFooter && <Footer />}
    </div>
  );
}
