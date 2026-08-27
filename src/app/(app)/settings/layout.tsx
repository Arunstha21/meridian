import { SettingsNav } from "@/components/layout/settings-nav";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10">
      <SettingsNav />
      <div className="min-w-0 space-y-6">{children}</div>
    </div>
  );
}
