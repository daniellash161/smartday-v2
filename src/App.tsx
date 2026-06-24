import { useState } from 'react';
import DashboardLayout from './components/DashboardLayout';
import Onboarding from './components/Onboarding';
import { hasSession, isOnboarded } from './utils/onboarding';
import './App.css';

type Route = 'onboarding' | 'dashboard';

function App() {
  const [route, setRoute] = useState<Route>(() =>
    hasSession() && isOnboarded() ? 'dashboard' : 'onboarding'
  );

  if (route === 'onboarding') {
    return <Onboarding onComplete={() => setRoute('dashboard')} />;
  }

  return <DashboardLayout onExitToOnboarding={() => setRoute('onboarding')} />;
}

export default App;
