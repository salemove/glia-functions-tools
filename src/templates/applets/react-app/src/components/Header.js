import React from 'react';

/**
 * Header component with title and subtitle
 * 
 * @param {Object} props - Component props
 * @param {string} props.title - Header title
 * @param {string} props.subtitle - Header subtitle/description
 */
function Header({ title, subtitle }) {
  return (
    <header className="bg-primary-700 text-white p-6">
      <h1 className="text-2xl font-bold">{title}</h1>
      {subtitle && <p className="mt-1 text-primary-100">{subtitle}</p>}
    </header>
  );
}

export default Header;