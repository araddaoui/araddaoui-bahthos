import React from 'react';

export const SynthesisHistory: React.FC = () => {
  return (
    <div className="p-4 bg-slate-800 text-white rounded">
      <h2 className="text-lg font-bold mb-2">Synthesis History</h2>
      <p className="text-sm text-slate-300">No previous synthesis history found.</p>
    </div>
  );
};

export default SynthesisHistory;
