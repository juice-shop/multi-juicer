import React from "react";

import multiJuicerLogo from "./multi-juicer.svg";
import { Card } from "./Components";
import { Footer } from "./Footer";
import { classNames } from "./util/classNames";

const pageMargins = "2xl:mx-80 lg:mx-48 md:mx-24 sm:mx-16 mx-2";

export function Layout({ children, switchLanguage, selectedLocale }) {
  return (
    <div className="grid grid-rows-[min-content_auto_min-content] h-screen w-screen gap-6 p-3 md:p-8">
      <div className={classNames("min-h-32", pageMargins)}>
        <Card className="flex items-center justify-center bg-background-highlight p-5">
          <img
            src={multiJuicerLogo}
            alt="MultiJuicer Logo"
            className="max-h-24"
          />
        </Card>
      </div>
      <div
        className={classNames(
          "flex flex-col items-center justify-center",
          pageMargins
        )}
      >
        {children}
      </div>
      <footer className="flex justify-center">
        <Footer
          switchLanguage={switchLanguage}
          selectedLocale={selectedLocale}
        />
      </footer>
    </div>
  );
}
