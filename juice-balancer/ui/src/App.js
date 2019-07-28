import React from 'react';
import { BrowserRouter as Router, Route } from 'react-router-dom';

import { JoinPage } from './pages/JoinPage';
import { JoiningPage } from './pages/JoiningPage';
import { JoinedPage } from './pages/JoinedPage';
import { AdminPage } from './pages/AdminPage';

function App() {
  return (
    <Router basename="/balancer">
      <Route path="/" exact component={JoinPage} />
      <Route path="/admin" component={AdminPage} />
      <Route path="/teams/:team/joining/" component={JoiningPage} />
      <Route path="/teams/:team/joined/" component={JoinedPage} />
    </Router>
  );
}

export default App;
