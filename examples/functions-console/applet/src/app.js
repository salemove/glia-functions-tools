// App.js
import React, { useState } from 'react';
import Dashboard from './components/Dashboard';
import FunctionList from './components/FunctionList';
import CreateFunction from './components/CreateFunction';
import FunctionDetails from './components/FunctionDetails';
import Navbar from './components/Navbar';
import './styles.css';

function App() {
  const [view, setView] = useState('dashboard');
  const [history, setHistory] = useState(['dashboard']);
  const [functions, setFunctions] = useState([]);

  const navigateTo = view => {
    setView(view);
    setHistory([...history, view]);
  };

  const handleFunctionCreation = newFunction => {
    setFunctions([...functions, newFunction]);
    navigateTo('functionList');
  };

  const handleBack = () => {
    if (history.length > 1) {
      history.pop(); // Remove the current view from history
      setView(history[history.length - 1]); // Set the view to the previous one
    }
  };

  const handleForward = () => {
    if (history.length > 1) {
      const currentIndex = history.indexOf(view);
      if (currentIndex !== -1 && currentIndex < history.length - 1) {
        setView(history[currentIndex + 1]); // Set the view to the next one in history
      }
    }
  };

  console.log(view, history)

  return (
    <div className="container mx-auto px-4">
      <Navbar handleBack={handleBack} handleForward={handleForward} navigateTo={navigateTo} />
      {view === 'dashboard' && <Dashboard navigateTo={navigateTo}/>}
      {view === 'functionList' && <FunctionList functions={functions} navigateTo={navigateTo} />}
      {view === 'createFunction' && <CreateFunction onCreate={handleFunctionCreation} />}
      {view === 'functionDetails' && <FunctionDetails navigateTo={navigateTo} />}
    </div>
  );
}

export default App;