import React from 'react';
import { withRouter } from 'react-router-dom';

import { Layout } from '../Layout';
import { TeamDisplayCard } from '../cards/TeamDisplayCard';
import { InstanceStatusCard } from '../cards/InstanceStatusCard';
import { PasscodeDisplayCard } from '../cards/PassCodeDisplayCard';

export const JoinedPage = withRouter(({ location, match }) => {
  const { team } = match.params;

  return (
    <Layout>
      <>
        <TeamDisplayCard teamname={team} />
        {location.state !== undefined ? (
          <PasscodeDisplayCard passcode={location.state.passcode} />
        ) : null}
        <InstanceStatusCard teamname={team} />
      </>
    </Layout>
  );
});
