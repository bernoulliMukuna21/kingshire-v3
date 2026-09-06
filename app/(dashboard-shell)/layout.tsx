import DashboardShell from "@/components/DashboardShell";
import TermsConsentModal from "@/components/TermsConsentModal";
import { getDashboardContext } from "@/lib/dashboard-context";
import { hasAcceptedCurrentTerms } from "@/lib/terms";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile, organisations } = await getDashboardContext();
  const needsTerms = !hasAcceptedCurrentTerms(profile.terms_accepted_version);

  return (
    <DashboardShell profile={profile} organisations={organisations}>
      {needsTerms && <TermsConsentModal />}
      {children}
    </DashboardShell>
  );
}
