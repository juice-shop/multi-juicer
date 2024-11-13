import React from "react";

import { Card } from "./Components";
import { Footer } from "./Footer";
import { classNames } from "./util/classNames";
import { type Language } from "./translations";
import { Link } from "react-router-dom";

const pageMargins = "2xl:mx-80 lg:mx-48 md:mx-24 sm:mx-16 mx-2";

export function Layout({
  children,
  switchLanguage,
  selectedLocale,
}: {
  children: React.ReactNode;
  switchLanguage: (language: Language) => void;
  selectedLocale: string;
}) {
  return (
    <div className="grid grid-rows-[min-content_auto_min-content] h-screen w-screen gap-6">
      <div className={classNames("min-h-32 mt-3 md:mt-8", pageMargins)}>
        <Link to="/">
          <Card className="flex items-center justify-center bg-background-highlight p-5">
            <img
              src="/balancer/multi-juicer.svg"
              alt="MultiJuicer Logo"
              className="max-h-24"
            />
          </Card>
        </Link>
      </div>
      <div
        className={classNames(
          "flex flex-col items-center justify-center",
          pageMargins
        )}
      >
        {children}
      </div>
      <footer className="flex justify-center mb-3 md:mb-8">
        <Footer
          switchLanguage={switchLanguage}
          selectedLocale={selectedLocale}
        />
      </footer>
    </div>
  );
}
