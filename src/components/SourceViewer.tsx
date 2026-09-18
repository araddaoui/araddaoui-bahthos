import React from 'react';

export const SourceViewer: React.FC = () => {
  return (
    <div className="p-4 bg-slate-800 text-white rounded">
      <h2 className="text-lg font-bold mb-2">Source Viewer</h2>
      <p className="text-sm text-slate-300">No source currently selected.</p>
    </div>
  );
};

export default SourceViewer;
