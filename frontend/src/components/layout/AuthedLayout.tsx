import { type ReactNode } from "react";
import { TopNav } from "./TopNav";

interface AuthedLayoutProps {
  children: ReactNode;
}

export function AuthedLayout({ children }: AuthedLayoutProps) {
  return (
    <>
      <TopNav />
      <main className="min-h-screen pt-14">
        <div className="mx-auto max-w-container px-6 md:px-8">
          {children}
        </div>
      </main>
    </>
  );
}
