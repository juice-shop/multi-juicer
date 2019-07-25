import React from 'react';
import styled from 'styled-components';

import { BodyCard, H2, Label } from '../Components';

const CharDisplay = styled.span`
  font-family: monospace;
  padding: 12px 8px;
  background-color: #d8d8d8;
  border-radius: 4px;
  margin-right: 8px;
  margin-left: ${props => (props.addOffset ? '8px' : '0')};
  display: inline-block;
`;

const CenteredContent = styled.div`
  display: flex;
  justify-content: center;
  margin-top: 16px;
`;

export const PasscodeDisplayCard = ({ passcode = '' }) => {
  return (
    <BodyCard>
      <H2>Team Created</H2>
      <p>
        To make sure not just anyone can join your team, we created a{' '}
        <strong>shared passcode</strong> for your team. If your teammates want to access the same
        instance they are required to enter the passcode first. You can{' '}
        <strong>copy the passcode</strong> from the display below.
      </p>

      <CenteredContent>
        <div>
          <Label>Passcode</Label>
          {passcode.split('').map((char, index) => (
            <CharDisplay addOffset={index === 4} key={index}>
              {char}
            </CharDisplay>
          ))}
        </div>
      </CenteredContent>
    </BodyCard>
  );
};
