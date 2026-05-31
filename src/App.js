import React from 'react';
import RootProvider from './app/providers/RootProvider.jsx';
import AppShell from './app/App.js';

function App() {
  return (
    <RootProvider>
      <AppShell />
    </RootProvider>
  );
}

export default App;
