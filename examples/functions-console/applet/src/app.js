// App.js
import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import FunctionList from './components/FunctionList';
import CreateFunction from './components/CreateFunction';
import FunctionDetails from './components/FunctionDetails';
import Navbar from './components/Navbar';
import listFunctionsPromise from './promises/listFunctions';
import postInvocationStatsPromise from './promises/postInvocationStats'
import './styles.css';

function App() {
  const [view, setView] = useState('dashboard');
  const [history, setHistory] = useState(['dashboard']);
  const [functions, setFunctions] = useState([]);
  const [invocationStats, setInvocationStats] = useState([]);
  const [fn, setFn] = useState('');

  const navigateTo = (view, func) => {
    setView(view);
    setFn(func);
    setHistory([...history, { view, func }]);
  };

  const handleFunctionCreation = newFunction => {
    setFunctions([...functions, newFunction]);
    navigateTo('functionList');
  };

  const handleBack = () => {
    if (history.length > 1) {
      history.pop(); // Remove the current view from history
      setView(history[history.length - 1].view); // Set the view to the previous one
    }
  };

  const handleForward = () => {
    if (history.length > 1) {
      const currentIndex = history.indexOf(view);
      if (currentIndex !== -1 && currentIndex < history.length - 1) {
        setView(history[currentIndex + 1].view); // Set the view to the next one in history
      }
    }
  };

  useEffect(() => {
    console.log('CALLING GLIA API')
    window.getGliaApi({version: 'v1'})
        .then(api => api.getRequestHeaders()
          .then(headers => listFunctionsPromise('1a630180-0982-4d92-b456-786fbe01575e', headers)
            .then(functions => functions.json()
              .then(functionsJson => {
                console.log(functionsJson)
                setFunctions(functionsJson.functions)
                return functionsJson
              })
              .then(functionsJson => {
                const functionIdsArray = functionsJson.functions.map(func => func.id);
                console.log(headers)
                console.log(functionIdsArray)
                postInvocationStatsPromise(headers, functionIdsArray)
                .then(statsResponse => statsResponse.json()
                  .then(statsJson => console.log(statsJson)))
              })
            )
          )
        )
  }, []); 

  console.log(view, history)

  return (
    <div className="container mx-auto px-4">
      <Navbar handleBack={handleBack} handleForward={handleForward} navigateTo={navigateTo} />
      {view === 'dashboard' && <Dashboard navigateTo={navigateTo}/>}
      {view === 'functionList' && <FunctionList functions={functions} navigateTo={navigateTo} />}
      {view === 'createFunction' && <CreateFunction onCreate={handleFunctionCreation} />}
      {view === 'functionDetails' && <FunctionDetails func={fn} navigateTo={navigateTo} />}
    </div>
  );
}

export default App;