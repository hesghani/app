// Decides whether a listing is a Merch on Demand product. Merch listings carry
// stock bullet points Amazon writes for every product of a given type, so the
// strongest signal is finding one of those exact phrases. Fragments of them
// also appear on some blank-shirt listings, so they only count for half.

import type { MerchVerdict } from './types';
import { fold } from './text';

const STRONG = [
  'lightweight classic fit double needle sleeve and bottom hem',
  'leicht klassisch geschnitten doppelt genahter saum',
  'leger coupe classique manches double couture et ourlet bas',
  'leggera taglio classico maniche con doppia cucitura',
  'ligera encaje clasico manga de doble puntada',
  '8 5 oz classic fit twill taped neck',
  'solid colors 100 cotton heather grey 90 cotton 10 polyester',
  'heather grey 90 cotton 10 polyester all other heathers',
];

const WEAK = [
  'double needle sleeve and bottom hem',
  'doppelt genahter saum',
  'manches double couture',
  'doppia cucitura',
  'doble puntada',
  'twill taped neck',
  'unifarben 100 baumwolle',
  'couleurs unies 100 coton',
  'tinta unita 100 cotone',
  'colores solidos 100 algodon',
];

const JP_PHRASES = ['ダブルステッチ', '綿100%'];

export interface MerchSignals {
  title: string;
  bullets: string[];
  description?: string;
  soldByAmazon?: boolean;
}

export function merchScore({ title, bullets, description = '', soldByAmazon }: MerchSignals): number {
  const raw = [...bullets, description].join(' ');
  const body = fold(raw);
  let score = 0;
  if (STRONG.some((p) => body.includes(p))) score += 3;
  else if (WEAK.some((p) => body.includes(p))) score += 1.5;
  if (JP_PHRASES.some((p) => raw.includes(p))) score += 1.5;
  if (/popgrip|swappable top|austauschbar/i.test(raw) && /popsockets/i.test(`${title} ${raw}`)) score += 1.5;
  if (soldByAmazon) score += 1;
  if (/(?:t-?shirt|hoodie|sweatshirt|tank top|raglan|long sleeve|popsockets grip|tote bag|throw pillow)\s*$/i.test(title.trim())) {
    score += 0.5;
  }
  return score;
}

export function detectMerch(signals: MerchSignals): MerchVerdict {
  const score = merchScore(signals);
  if (score >= 3) return 'yes';
  if (score >= 1.5) return 'likely';
  return 'no';
}
