import React from 'react';

export const Icon = ({ d, size = 14 }) => (
  <svg className="ico" viewBox="0 0 24 24" width={size} height={size}
       fill="none" stroke="currentColor" strokeWidth="1.7"
       strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);

export const ICONS = {
  add:     <Icon d={<><path d="M12 5v14M5 12h14"/></>} />,
  trash:   <Icon d={<><path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"/></>} />,
  group:   <Icon d={<><path d="M3 6h7v12H3zM14 6h7v5h-7zM14 13h7v5h-7z"/></>} />,
  undo:    <Icon d={<><path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/></>} />,
  redo:    <Icon d={<><path d="M15 14l5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/></>} />,
  png:     <Icon d={<><path d="M4 16l4-4 4 4 8-8"/><rect x="3" y="3" width="18" height="18" rx="2"/></>} />,
  svg:     <Icon d={<><path d="M4 4h16v16H4z"/><path d="M8 12h2l1 3 1-6 1 3h3"/></>} />,
  samples: <Icon d={<><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></>} />,
  cycleAdd:<Icon d={<><path d="M3 12h12M9 6l6 6-6 6"/><path d="M19 5v14"/></>} />,
  cycleDel:<Icon d={<><path d="M21 12H9M15 6l-6 6 6 6"/><path d="M5 5v14"/></>} />,
  edge:    <Icon d={<><path d="M4 17c4-10 12-10 16 0"/><path d="M16 17l4 0M20 13l0 4"/></>} />,
};
