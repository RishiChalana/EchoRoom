import { Bell } from "lucide-react";
import { AuthedLayout } from "@/components/layout/AuthedLayout";

export default function NotificationsPage() {
  return (
    <AuthedLayout>
      <div className="pt-12 pb-16">
        <h1 className="font-display text-[32px] font-bold text-er-ink">Notifications</h1>

        <div className="mt-16 flex flex-col items-center text-center">
          <Bell size={32} className="text-er-ink-4" />
          <h2 className="mt-4 font-display text-[20px] font-semibold text-er-ink">
            No notifications yet.
          </h2>
          <p className="mt-2 max-w-[400px] font-sans text-[16px] text-er-ink-3">
            Notifications about your session analysis and progress will appear here.
          </p>
        </div>
      </div>
    </AuthedLayout>
  );
}
