import type { MerchantOffer, ProductId, RunState } from './model.js';
import { available } from './guards.js';
import { freezeDeep } from './immutable.js';

const PRODUCTS = freezeDeep({
  handle: { label: '配重锤柄', effect: '精准区每级向两侧各扩大 2 个百分点', prices: [{ coins: 100, scrap: 3 }, { coins: 180, scrap: 5 }] },
  bellows: { label: '强化风箱', effect: '每级令下一轮煤炭配给 +1', prices: [{ coins: 120, scrap: 4 }, { coins: 220, scrap: 6 }] },
  anvil: { label: '稳固砧台', effect: '每级裂损概率 -3 个百分点', prices: [{ coins: 160, scrap: 6 }, { coins: 260, scrap: 8 }] },
  repair: { label: '契约修补', effect: '恢复一枚契约印记，本次来访限一次', prices: [{ coins: 240, scrap: 6 }] },
});
export const PRODUCT_IDS: readonly ProductId[] = freezeDeep(['handle', 'bellows', 'anvil', 'repair']);

export function merchantOffer(state: RunState, productId: ProductId): MerchantOffer {
  const product = PRODUCTS[productId];
  const bought = state.purchases.some(purchase => purchase.afterRound === state.round && purchase.product === productId);
  const level = productId === 'repair' ? (bought ? 1 : 0) : state.upgrades[productId];
  const price = product.prices[productId === 'repair' ? 0 : level] ?? null;
  const reason = state.phase !== 'merchant' ? 'wrong_phase'
    : bought ? 'already_purchased'
    : price === null ? 'max_level'
    : productId === 'repair' && state.seals >= 3 ? 'repair_not_needed'
    : state.coins < price.coins ? 'insufficient_coins'
    : state.scrap < price.scrap ? 'insufficient_scrap' : null;
  return { productId, label: product.label, effect: product.effect, level,
    nextLevel: price === null || (productId === 'repair' && bought) ? null : productId === 'repair' ? 1 : level + 1,
    price, availability: available(reason) };
}
