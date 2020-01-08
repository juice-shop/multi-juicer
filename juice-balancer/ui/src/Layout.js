import React from 'react';

import styled, { createGlobalStyle } from 'styled-components';

import logo from './logo.svg';
import { Card, H1 } from './Components';

const Header = styled.div`
  background-color: #cf3a23;
  min-height: 128px;
  display: flex;
  justify-content: center;
  position: relative;
  margin-bottom: 64px;

  @media (max-width: 1280px) {
    min-height: 64px;
  }
`;

const Logo = styled.img`
  width: 64px;
  height: 64px;
  margin-right: 16px;
`;
Logo.defaultProps = {
  src: logo,
};

const HeaderCard = styled(Card)`
  padding: 36px 0;
  height: 96px;
  width: 50vw;
  position: absolute;
  bottom: -48px;
  display: flex;
  justify-content: center;
  align-items: center;

  @media (max-width: 640px) {
    min-width: 80vw;
    min-width: 344px;
  }
`;

const GlobalStyles = createGlobalStyle`
  html {
    box-sizing: border-box;
  }
  *, *:before, *:after {
    box-sizing: inherit;
  }
  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
    background-color: #f9fbfc;
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

export function Layout({ children, footer }) {
  return (
    <>
      <GlobalStyles />
      <Wrapper>
        <Header>
          <HeaderCard>
            <Logo alt="CTF Logo" />
            <H1>MultiJuicer</H1>
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
