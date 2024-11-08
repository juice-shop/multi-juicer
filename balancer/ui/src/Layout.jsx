import React from "react";

import multiJuicerLogo from "./multi-juicer.svg";
import { Card } from "./Components";

export function Layout({ children, footer }) {
  return (
    <div className="grid grid-rows-[min-content_auto_min-content] h-screen w-screen gap-6 p-8">
      <div className="min-h-32 md:min-h-24 2xl:mx-80 lg:mx-48 md:mx-32 sm:mx-16 xs:mx-4">
        <Card className="flex items-center justify-center bg-background-highlight p-5">
          <img
            src={multiJuicerLogo}
            alt="MultiJuicer Logo"
            className="max-h-24"
          />
        </Card>
      </div>
      <div className="flex flex-col items-center justify-center">
        {children}
      </div>
      <footer className="flex justify-center">{footer}</footer>
    </div>
  );
}
