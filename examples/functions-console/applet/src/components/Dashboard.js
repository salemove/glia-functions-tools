// Dashboard.js
import React from 'react';

const Dashboard = ({ navigateTo }) => {
  return (
    <div className="mt-8">
      <h1 className="text-3xl font-bold mb-4">Dashboard</h1>
      <button onClick={() => navigateTo('functionList')} className="bg-blue-500 text-white px-4 py-2 rounded">
        Manage Functions
      </button>
    </div>
  );
};

export default Dashboard;
