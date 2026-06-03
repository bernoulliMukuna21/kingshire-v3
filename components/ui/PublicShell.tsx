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
    <div className="min-h-screen overflow-x-hidden bg-slate-50">
      <Navbar />
      <main>{children}</main>
      {withFooter && <Footer />}
    </div>
  );
}
