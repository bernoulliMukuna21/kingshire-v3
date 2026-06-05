import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { PublicAuthProvider } from "@/components/auth/PublicAuthProvider";

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
      <PublicAuthProvider>
        <Navbar variant={navbarVariant} />
        <main className="flex-1">{children}</main>
      </PublicAuthProvider>
      {withFooter && <Footer />}
    </div>
  );
}
