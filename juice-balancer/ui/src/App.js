import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';

import { JoinPage } from './pages/JoinPage';
import { JoiningPage } from './pages/JoiningPage';
import { JoinedPage } from './pages/JoinedPage';
const AdminPage = lazy(() => import('./pages/AdminPage'));

function App() {
  return (
    <Router basename="/balancer">
      <Suspense fallback={<div>Loading...</div>}>
        <Switch>
          <Route path="/" exact component={JoinPage} />
          <Route path="/admin" component={AdminPage} />
          <Route path="/teams/:team/joining/" component={JoiningPage} />
          <Route path="/teams/:team/joined/" component={JoinedPage} />
        </Switch>
      </Suspense>
    </Router>
  );
}

export default App;
