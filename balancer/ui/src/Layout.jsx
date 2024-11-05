import React from "react";

import multiJuicerLogo from "./multi-juicer.svg";
import { Card } from "./Components";

export function Layout({ children, footer, siteHeader = null, wide = false }) {
  return (
    <div className="flex flex-col h-screen w-screen">
      <div className="min-h-32 flex justify-center my-16 mb-0 md:min-h-24">
        <Card
          className={`flex justify-evenly items-center min-w-[360px] bg-background-highlight ${
            wide ? "w-7/10" : "w-1/2"
          } md:w-13/20 sm:w-3/4 sm:flex-wrap sm:p-5`}
        >
          <img
            src={multiJuicerLogo}
            alt="MultiJuicer Logo"
            className="max-h-24"
          />
        </Card>
      </div>
      <div className="flex-grow flex flex-col items-center justify-center">
        <div className="flex-grow-50 flex flex-col items-center justify-center">
          {children}
        </div>
        <div className="flex-grow-1">{footer}</div>
      </div>
    </div>
  );
}
