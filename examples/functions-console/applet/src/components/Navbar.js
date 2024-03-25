// Navbar.js
import React from 'react';
import { FiChevronLeft, FiChevronRight, FiHome } from 'react-icons/fi';

const Navbar = ({ handleBack, handleForward, navigateTo }) => {
  return (
    <div className="flex justify-between items-center py-4">
      {navigateTo !== 'dashboard' && (
        <button onClick={handleBack} className="bg-blue-500 text-white px-4 py-2 rounded">
          <FiChevronLeft />
        </button>
      )}
      <h1 className="text-3xl font-bold">Serverless Function Manager</h1>
      <button onClick={() => navigateTo('dashboard')} className="bg-blue-500 text-white px-4 py-2 rounded">
        <FiHome />
      </button>
      <button onClick={handleForward} className="bg-blue-500 text-white px-4 py-2 rounded">
        <FiChevronRight />
      </button>
    </div>
  );
};

export default Navbar;