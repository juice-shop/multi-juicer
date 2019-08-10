import React from 'react';
import styled from 'styled-components';
import { FormattedMessage } from 'react-intl';

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

const PasscodeDisplayWrapper = styled.div``;

const FakePasscodeDisplay = styled.span`
  ${PasscodeDisplayWrapper}:hover & {
    display: none;
  }
`;

const PasscodeDisplay = styled.span`
  display: none;
  ${PasscodeDisplayWrapper}:hover & {
    display: block;
  }
`;

const CenteredContent = styled.div`
  display: flex;
  justify-content: center;
  margin-top: 16px;
`;

export const PasscodeDisplayCard = ({ passcode = '' }) => {
  return (
    <BodyCard>
      <H2>
        <FormattedMessage id="team_created" defaultMessage="Team Created" />
      </H2>
      <p>
        <FormattedMessage
          id="passcode_explanation"
          defaultMessage="To make sure not just anyone can join your team, we created a shared passcode for your team. If your teammates want to access the same instance they are required to enter the passcode first. You can copy the passcode from the display below."
        />
      </p>

      <CenteredContent>
        <div>
          <Label>
            <FormattedMessage id="passcode" defaultMessage="Passcode" />
          </Label>
          <PasscodeDisplayWrapper aria-label={`Passcode is: ${passcode}`}>
            <FakePasscodeDisplay>
              {'●●●●●●●●'.split('').map((char, index) => (
                <CharDisplay addOffset={index === 4} key={index} aria-hidden="true">
                  {char}
                </CharDisplay>
              ))}
            </FakePasscodeDisplay>
            <PasscodeDisplay data-test-id="passcode-display">
              {passcode.split('').map((char, index) => (
                <CharDisplay addOffset={index === 4} key={index}>
                  {char}
                </CharDisplay>
              ))}
            </PasscodeDisplay>
          </PasscodeDisplayWrapper>
        </div>
      </CenteredContent>
    </BodyCard>
  );
};
