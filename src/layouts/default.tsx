import * as React from "react";
import { Navbar } from "@/components/navbar";

export default function DefaultLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{backgroundColor: '#eee', minHeight: 900}} className="relative flex flex-col">
      <Navbar />
      <main className="container mx-auto max-w-7xl px-6 flex-grow">
        {children}
      </main>
      <footer className="w-full flex items-center justify-center py-3">

          <span className="text-default-600">Ligolo Tunnel Manager -</span>
          <p className="text-primary">#ITL</p>
      </footer>
    </div>
  );
}
