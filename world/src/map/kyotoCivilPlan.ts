/** Local reservations shared by the Kyoto generator and live grass masking. */
export const KYOTO_CIVIL_CLEARANCE = [
  [171, 48, 192, 62], // paper room and drying gallery
  [128, -102, 145, -93], // lower Sanjo wharf
  [-247, 157, -217, 179], // headquarters' working court
] as const;
export const KYOTO_CIVIL_PATHS = [
  [[-105, 105], [-100, 105], [-100, 81]],
  [[-200, 150], [-218, 148], [-232, 148], [-232, 166]],
  [[120, -97], [130, -97], [130, -67], [146, -67], [146, -75]],
  [[188, 43], [184, 50], [184, 60], [188, 69]],
] as const;
