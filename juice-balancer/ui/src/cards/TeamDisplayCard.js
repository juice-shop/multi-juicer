import React from 'react';
import styled from 'styled-components';
import { BodyCard, SecondaryButton, H3 } from '../Components';
import astronout from './astronaut.svg';

const TeamDisplayCardWrapper = styled(BodyCard)`
  display: flex;
  padding: 16px 32px;
  align-items: center;

  @media (max-width: 1280px) {
    padding: 12px 16px;
  }
`;

const AstronautIcon = styled.img`
  height: 48px;
  width: auto;
  margin-right: 12px;
`;
AstronautIcon.defaultProps = {
  src: astronout,
};

const TeamDisplayTextWrapper = styled.div`
  flex-grow: 1;
`;

const Subtitle = styled.span`
  font-size: 14px;
  color: #232323;
  font-weight: 300;
`;

export const TeamDisplayCard = ({ teamname }) => {
  return (
    <TeamDisplayCardWrapper>
      <AstronautIcon />
      <TeamDisplayTextWrapper>
        <Subtitle>Logged in as</Subtitle>
        <H3>{teamname}</H3>
      </TeamDisplayTextWrapper>
      <SecondaryButton>Logout</SecondaryButton>
    </TeamDisplayCardWrapper>
  );
};
