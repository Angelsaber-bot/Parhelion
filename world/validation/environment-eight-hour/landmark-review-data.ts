/** Existing authored landmarks only. World coordinates, no runtime content changes.
 * HQ/Honnoji main shells are intentionally solid; sample usable armory / temple court instead. */
export const LANDMARK_REVIEW = [
  { region: 'alpha', title: 'Original armory hangar', origin: [-74,10,250], marker: 'armory_rack',
    route: [[-93,250],[-87,250],[-81,250],[-78,246]],
    poses: [['approach',-93,250,-74,12,250],['interior',-78,246,-65,11.5,250]] },
  { region: 'britain', title: 'Original Round Table Hall', origin: [-935,34,-165], marker: 'hall_brazier_1',
    route: [[-922,-178],[-925.8,-174.2],[-928.5,-171.5]],
    poses: [['approach',-922,-178,-935,37,-165],['interior',-928.5,-171.5,-935,35.2,-165]] },
  { region: 'blacksail', title: 'Original Nassau tavern', origin: [592,3.4,128], marker: 'blackbeard_meet',
    route: [[592,141],[592,134],[592,130],[592,127]],
    poses: [['approach',592,141,592,5.5,128],['interior',592,130,592,4.7,124.7]] },
  { region: 'winter', title: 'Original Kremlin south gate and court', origin: [-6,12,-874], marker: null,
    route: [[-6,-866],[-6,-874],[-6,-884]],
    poses: [['approach',-6,-866,-6,18,-874],['interior',-6,-884,-8,17,-910]] },
  { region: 'kyoto', title: 'Original Honnoji east gate and charred court', origin: [-90,4.6,765], crop: 60, marker: 'fire_core',
    route: [[-43,765],[-49,765],[-55,765],[-64,765],[-61,775]],
    poses: [['approach',-43,765,-55,8,765],['interior',-61,775,-118,11,765]] },
] as const;
