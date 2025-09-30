import * as React from "react";
import { Navbar } from "@/components/navbar";

export default function DefaultLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="relative flex min-h-[900px] flex-col bg-slate-100 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100"
    >
      <Navbar />
      <main className="container mx-auto flex-grow px-6">
        {children}
      </main>
      <footer className="flex w-full items-center justify-center py-3">
        <span className="text-default-600">Ligolo Tunnel Manager -</span>
        <p className="text-primary">#ITL</p>
      </footer>
    </div>
  );
}
