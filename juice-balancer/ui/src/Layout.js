import React from 'react';

import styled, { createGlobalStyle } from 'styled-components';

import multiJuicerLogo from './multi-juicer.svg';
import { Card } from './Components';

const Header = styled.div`
  min-height: 128px;
  display: flex;
  justify-content: center;
  margin: 64px;
  margin-bottom: 0;

  @media (max-width: 1280px) {
    min-height: 96px;
  }
`;

const Logo = styled.img`
  height: 72px;
`;
Logo.defaultProps = {
  src: multiJuicerLogo,
};

const HeaderCard = styled(Card)`
  width: ${props => props.wide ? "70vw" : "50vw"};
  display: flex;
  justify-content: space-evenly;
  align-items: center;
  min-width: 360px;
  background-color: var(--background-highlight);

  @media (max-width: 720px) {
    flex-wrap: wrap;
    padding: 20px;
  }

  @media (max-width: 1024px) {
    width: 65vw;
  }
  @media (max-width: 640px) {
    width: 75vw;
  }
`;

const GlobalStyles = createGlobalStyle`
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
`;

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
`;

const Body = styled.div`
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
`;

const BodyWrapper = styled.div`
  flex-grow: 50;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
`;

const Footer = styled.div`
  flex-grow: 1;
`;

const SiteHeader = styled.h1`
  margin-top: 38px;
  font-size: 40px;
  font-weight: normal;
  
  @media (max-width: 720px) {
    margin-top: 16px;
    margin-bottom: 0;
  }
`

export function Layout({ children, footer, siteHeader = null, wide = false }) {
  return (
    <>
      <GlobalStyles />
      <Wrapper>
        <Header>
          <HeaderCard wide={wide}>
            <Logo alt="MultiJuicer Logo" />
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
