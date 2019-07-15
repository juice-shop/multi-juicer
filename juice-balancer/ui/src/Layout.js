import React from 'react';

import styled, { createGlobalStyle } from 'styled-components';

import logo from './logo.svg';
import { Card, H1 } from './Components';

const Header = styled.div`
  background-color: #cf3a23;
  height: 128px;
  display: flex;
  justify-content: center;
  position: relative;
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
  min-width: 500px;
  position: absolute;
  bottom: -48px;
  display: flex;
  justify-content: center;
  align-items: center;
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
  background-color: #f9fbfc;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
`;

export function Layout({ children }) {
  return (
    <>
      <GlobalStyles />
      <Wrapper>
        <Header>
          <HeaderCard>
            <Logo alt="CTF Logo" />
            <H1>Juicy CTF</H1>
          </HeaderCard>
        </Header>
        <Body>{children}</Body>
      </Wrapper>
    </>
  );
}
