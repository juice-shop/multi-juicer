import React from 'react';
import { BrowserRouter as Router, Route } from 'react-router-dom';

import { JoinPage } from './pages/JoinPage';
import { JoiningPage } from './pages/JoiningPage';
import { JoinedPage } from './pages/JoinedPage';

function App() {
  return (
    <Router basename="/balancer">
      <Route path="/" exact component={JoinPage} />
      <Route path="/teams/:team/joining/" component={JoiningPage} />
      <Route path="/teams/:team/joined/" component={JoinedPage} />
    </Router>
  );
}

export default App;
