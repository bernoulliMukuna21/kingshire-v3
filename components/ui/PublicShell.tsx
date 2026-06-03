import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function PublicShell({
  children,
  withFooter = true,
}: {
  children: React.ReactNode;
  withFooter?: boolean;
}) {
  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-slate-50">
      <Navbar />
      <main className="flex-1">{children}</main>
      {withFooter && <Footer />}
    </div>
  );
}
