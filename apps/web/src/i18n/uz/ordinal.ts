const WORDS = [
  '', 'Birinchi', 'Ikkinchi', 'Uchinchi', 'To‘rtinchi', 'Beshinchi', 'Oltinchi', 'Yettinchi', 'Sakkizinchi',
  'To‘qqizinchi', 'O‘ninchi', 'O‘n birinchi', 'O‘n ikkinchi', 'O‘n uchinchi', 'O‘n to‘rtinchi', 'O‘n beshinchi',
  'O‘n oltinchi', 'O‘n yettinchi', 'O‘n sakkizinchi', 'O‘n to‘qqizinchi', 'Yigirmanchi'
];

/** "To‘rtinchi" up to twenty, then "21-". */
export const ordinalWordUz = (n: number): string => (n >= 1 && WORDS[n]) || `${n}-`;
