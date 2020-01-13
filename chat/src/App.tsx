import React from 'react';
import 'normalize.css';

import ChatInterface from './components/ChatInterface';
import './App.scss';

const App: React.FC = () => {
  return (
    <div className="App">
      <ChatInterface />
    </div>
  );
};

export default App;
