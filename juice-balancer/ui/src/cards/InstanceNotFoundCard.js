import React from 'react';
import styled from 'styled-components';

import { BodyCard } from '../Components';

import warning from './warning.svg';

const WarningIcon = styled.img`
  height: 48px;
  width: auto;
  margin-right: 12px;
`;
WarningIcon.defaultProps = {
  src: warning,
};

const CenteredCard = styled(BodyCard)`
  display: flex;
  justify-content: center;
  align-items: center;
`;

export const InstanceNotFoundCard = () => {
  return (
    <CenteredCard>
      <WarningIcon />
      <span data-test-id="instance-not-found">
        Could not find the instance for the team. You can recreate it by logging back in.
      </span>
    </CenteredCard>
  );
};
