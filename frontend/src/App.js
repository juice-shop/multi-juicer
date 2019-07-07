import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { BrowserRouter as Router, Route, withRouter } from 'react-router-dom';

import styled, { createGlobalStyle } from 'styled-components';

import { Spinner } from './Spinner';
import logo from './logo.svg';

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

const Card = styled.div`
  border-radius: 8px;
  box-shadow: rgba(0, 0, 0, 0.4) 1px 1px 4px 0px;
  background-color: #fff;
`;
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
const BodyCard = styled(Card)`
  padding: 32px 32px;
  width: 40vw;
  min-width: 400px;
  margin-bottom: 32px;
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

const H1 = styled.h1`
  font-size: 36px;
  font-weight: 600;
  margin: 0;
`;
const H2 = styled.h2`
  font-size: 36px;
  font-weight: 500;
  margin: 0;
  margin-bottom: 24px;
`;

const Input = styled.input`
  background-color: #d8d8d8;
  border: none;
  border-radius: 4px;
  padding: 12px 4px;
  font-size: 14px;
  display: block;
  width: 100%;
`;
const Label = styled.label`
  font-weight: 300;
  display: block;
  margin-bottom: 4px;
`;
const Form = styled.form`
  margin-top: 32px;
`;

const Button = styled.button`
  background-color: #cf3a23;
  padding: 12px;
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  display: block;
  width: 100%;
  border-radius: 4px;
  border: none;
  margin-top: 12px;
  cursor: pointer;
`;

const CenteredText = styled.span`
  text-align: center;
  display: block;
`;

const JoinForm = withRouter(({ history }) => {
  const [teamname, setTeamname] = useState('');
  const [failed, setFailed] = useState(false);
  const passcode = undefined;

  async function sendJoinRequest() {
    try {
      const { data } = await axios.post(`/balancer/teams/${teamname}/join`, {
        passcode,
      });

      console.log('got data back');
      console.log(data);

      history.push(`/teams/${teamname}/creating/`, { passcode: data.passcode });
    } catch (err) {
      console.error(err);
      history.push(`/teams/${teamname}/creating/`, { passcode: '12345678' });
      setFailed(true);
    }
  }

  function onSubmit(event) {
    event.preventDefault();
    sendJoinRequest({ teamname });
  }

  return (
    <Wrapper>
      <Header>
        <HeaderCard>
          <Logo alt="CTF Logo" />
          <H1>Juicy CTF</H1>
        </HeaderCard>
      </Header>
      <Body>
        <BodyCard>
          <H2>Getting Started</H2>
          <p>
            Chose a <strong>teamname</strong> so that we will be able to
            recognise you back.
          </p>
          <p>
            If you want to <strong>team up</strong> with other people you can
            join up under the same teamname.
          </p>

          {failed ? <strong>Failed to join the team</strong> : null}

          <Form onSubmit={onSubmit}>
            <Label htmlFor="teamname">Teamname</Label>
            <Input
              type="text"
              id="teamname"
              name="teamname"
              value={teamname}
              onChange={({ target }) => setTeamname(target.value)}
            />
            <Button type="submit">Create / Join Team</Button>
          </Form>
        </BodyCard>
      </Body>
    </Wrapper>
  );
});

const CenteredCard = styled(BodyCard)`
  display: flex;
  justify-content: center;
  align-items: center;
`;

const CharDisplay = styled.span`
  font-family: monospace;
  padding: 12px 8px;
  background-color: #d8d8d8;
  border-radius: 4px;
  margin-right: 8px;
  margin-left: ${props => (props.offset ? '8px' : '0')};
  display: inline-block;
`;

function PasscodeDisplay({ passcode = '' }) {
  return (
    <div>
      {passcode.split('').map((char, index) => {
        return <CharDisplay offset={index === 4}>{char}</CharDisplay>;
      })}
    </div>
  );
}

const CreatedConfirm = withRouter(({ location, match }) => {
  const { passcode } = location.state;
  const { team } = match.params;

  const [ready, setReady] = useState(true);
  useEffect(() => {
    axios
      .get(`/balancer/${team}/wait-till-ready`)
      .then(() => {
        setReady(true);
      })
      .catch(() => {
        console.error('Failed to wait for deployment readyness');
      });
  }, [team]);

  return (
    <Wrapper>
      <Header>
        <HeaderCard>
          <Logo alt="CTF Logo" />
          <H1>Juicy CTF</H1>
        </HeaderCard>
      </Header>
      <Body>
        <BodyCard>
          <H2>Team Created</H2>
          <p>
            To make sure not anyone can just join your team, we created a{' '}
            <strong>shared passcode</strong> for your team. If your teammates
            want to access the same instance they are required to enter the
            passcode first. You can <strong>copy the passcode</strong> from the
            display below.
          </p>

          <Label style={{ marginTop: '16px' }}>Passcode</Label>
          <PasscodeDisplay passcode={passcode} />
        </BodyCard>

        {ready ? (
          <BodyCard>
            <CenteredText>
              <span role="img" aria-label="Done">
                ✅
              </span>{' '}
              Juice Shop Instance ready
            </CenteredText>
            <Button
              onClick={() => {
                window.location = '/';
              }}
            >
              Start Hacking
            </Button>
          </BodyCard>
        ) : (
          <CenteredCard>
            <Spinner />
            <span>Starting a new Juice Shop Instance</span>
          </CenteredCard>
        )}
      </Body>
    </Wrapper>
  );
});

function App() {
  return (
    <>
      <GlobalStyles />

      <Router basename="/balancer">
        <Route path="/" exact component={JoinForm} />
        <Route path="/teams/:team/creating/" component={CreatedConfirm} />
      </Router>
    </>
  );
}

export default App;
