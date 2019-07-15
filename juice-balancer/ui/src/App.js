import React from 'react';
import { BrowserRouter as Router, Route } from 'react-router-dom';

import { JoinPage } from './pages/JoinPage';
import { CreatingPage } from './pages/CreatingPage';

function App() {
  return (
    <Router basename="/balancer">
      <Route path="/" exact component={JoinPage} />
      <Route path="/teams/:team/creating/" component={CreatingPage} />
    </Router>
  );
}

export default App;
