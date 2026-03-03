interface DashboardPageLayoutProps {
  children: React.ReactNode;
}

export default function DashboardPageLayout({
  children,
}: DashboardPageLayoutProps): React.ReactElement {
  return <>{children}</>;
}
