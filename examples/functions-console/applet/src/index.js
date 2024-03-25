import React from 'react';
import ReactDOM from 'react-dom';
import App from './app';

window.addEventListener("DOMContentLoaded", function (e) {
   ReactDOM.createRoot(
      document.getElementById("root"),
    )
    .render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
})