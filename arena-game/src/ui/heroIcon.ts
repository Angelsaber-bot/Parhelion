/** Small monochrome insignia, rendered consistently across platforms (no emoji fonts). */
const paths:Record<number,string>={
  2:'<path d="m4 16-1-9 5 4 4-7 4 7 5-4-1 9M5 20h14M6 16h12"/>',
  3:'<path d="M12 3v14M11 4 4 14h7m3-8 5 8h-5M3 18l3 3h12l3-3H3Z"/>',
  4:'<path d="m4 3 3 1 12 14-2 2L5 6 4 3Zm16 0-3 1-5 6m-2 4-3 4 2 2 4-4M3 19l3 3m12-3 3 3M5 17l5 4m4-4 5 4"/>',
  5:'<path d="m4 14 13-8 3 5-13 7-3-4Zm11-9 3-2 4 7-3 2M5 19h15M16 14l3 5"/><circle cx="7" cy="19" r="3"/>',
  6:'<path d="M6 22V3m0 1h13v11l-6-2-7 2M10 8h5m-2.5-2v5"/>',
  7:'<circle cx="12" cy="12" r="5"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>',
  8:'<path d="M4 5h16v14H4zM8 2v3m8-3v3M8 19v3m8-3v3M8 9h8m-4 0v6m-4 0h8M2 9h2m16 0h2M2 15h2m16 0h2"/>',
};
export function heroIcon(char:number){return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[char]??paths[2]}</svg>`;}
