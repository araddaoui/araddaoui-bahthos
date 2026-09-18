import React from 'react';

export const Sidebar: React.FC = () => {
  return (
    <aside className="w-64 bg-slate-900 text-white p-4 min-h-screen">
      <div className="text-xl font-bold mb-6">BahthOS</div>
      <nav className="space-y-2">
        <a href="#" className="block px-3 py-2 rounded hover:bg-slate-800">Dashboard</a>
      </nav>
    </aside>
  );
};

export default Sidebar;
