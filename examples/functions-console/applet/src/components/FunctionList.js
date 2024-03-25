// FunctionList.js
import React from 'react';

const FunctionList = ({ functions, navigateTo }) => {
  return (
    <div className="mt-8">
      <h1 className="text-3xl font-bold mb-4">Function List</h1>
      <ul>
        {functions.map(func => (
          <li
            key={func.id}
            onClick={() => navigateTo('functionDetails')} // Correctly calls navigateTo function
            className="cursor-pointer text-blue-500 hover:underline mb-2"
          >
            {func.name} - {func.description}
          </li>
        ))}
      </ul>
      <button onClick={() => navigateTo('createFunction')} className="bg-blue-500 text-white px-4 py-2 rounded mt-4">
        Create New Function
      </button>
    </div>
  );
};

export default FunctionList;
