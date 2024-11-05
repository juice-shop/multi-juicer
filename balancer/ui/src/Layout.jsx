import React from 'react';

import multiJuicerLogo from './multi-juicer.svg';
import { Card } from './Components';

const Header = ({ children }) => (
  <div className="min-h-32 flex justify-center my-16 mb-0 md:min-h-24">
    {children}
  </div>
);

const Logo = ({ src, alt }) => (
  <img src={src} alt={alt} className="h-18" />
);
Logo.defaultProps = {
  src: multiJuicerLogo,
  alt: "MultiJuicer Logo",
};

const HeaderCard = ({ children, wide }) => (
  <Card className={`flex justify-evenly items-center min-w-[360px] bg-background-highlight ${wide ? 'w-7/10' : 'w-1/2'} md:w-13/20 sm:w-3/4 sm:flex-wrap sm:p-5`}>
    {children}
  </Card>
);

const GlobalStyles = () => (
  <style>
    {`
      :root {
        --background: #f9fbfc;
        --background-highlight: #fff;
        --font-color: #000;
        --font-color-highlight: #000;
      }
      @media (prefers-color-scheme: dark) {
        :root {
          --background: #1a202c;
          --background-highlight: #2d3848;
          --font-color: #fefefe;
          --font-color-highlight: #CBD5DF;
        }
      }
      html {
        box-sizing: border-box;
      }
      *, *:before, *:after {
        box-sizing: inherit;
      }
      body {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
        background-color: var(--background);
        color: var(--font-color);
      }
    `}
  </style>
);

const Wrapper = ({ children }) => (
  <div className="flex flex-col h-screen w-screen">
    {children}
  </div>
);

const Body = ({ children }) => (
  <div className="flex-grow flex flex-col items-center justify-center">
    {children}
  </div>
);

const BodyWrapper = ({ children }) => (
  <div className="flex-grow-50 flex flex-col items-center justify-center">
    {children}
  </div>
);

const Footer = ({ children }) => (
  <div className="flex-grow-1">
    {children}
  </div>
);

const SiteHeader = ({ children }) => (
  <h1 className="mt-9 text-5xl font-normal sm:mt-4 sm:mb-0">
    {children}
  </h1>
);

export function Layout({ children, footer, siteHeader = null, wide = false }) {
  return (
    <>
      <GlobalStyles />
      <Wrapper>
        <Header>
          <HeaderCard wide={wide}>
            <Logo />
            {siteHeader ? (
              <SiteHeader>
                {siteHeader}
              </SiteHeader>
            ) : null}
          </HeaderCard>
        </Header>
        <Body>
          <BodyWrapper>{children}</BodyWrapper>
          <Footer>{footer}</Footer>
        </Body>
      </Wrapper>
    </>
  );
}
