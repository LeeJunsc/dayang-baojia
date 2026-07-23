/**
 * A家打样报价规则配置(2026-07-22 确认版,同日袋型体系调整)
 * 所有价格、折扣、公式参数集中在此,改价只动这个文件。
 * 金额单位:元;尺寸单位:cm。
 */

export type BagType = '三边封袋' | '自立袋' | '风琴袋' | '中封袋' | '八边封袋'
export type Surface = '亮面' | '哑面'
/** 材质:不影响价格,仅进入报价描述 */
export type Material = '透明' | '镀铝' | '纯铝' | '牛皮'
export const MATERIALS: Material[] = ['透明', '镀铝', '纯铝', '牛皮']

/** 袋型家族:普通袋系 / 八边封系(决定开窗单价) */
export type BagFamily = 'normal' | 'eightSide'

export const BAG_FAMILY: Record<BagType, BagFamily> = {
  三边封袋: 'normal',
  自立袋: 'normal',
  风琴袋: 'normal',
  中封袋: 'normal',
  八边封袋: 'eightSide',
}

/** 各袋型的风琴输入:无 / 底风琴 / 侧风琴 */
export type GussetKind = 'none' | 'bottom' | 'side'

export const GUSSET_KIND: Record<BagType, GussetKind> = {
  三边封袋: 'none',
  自立袋: 'bottom',
  风琴袋: 'side',
  中封袋: 'none',
  八边封袋: 'side',
}

export const RULES = {
  /** 印刷:600元/㎡,低消100元 */
  printing: { pricePerM2: 600, minCharge: 100 },

  /** 复合制袋费(元/个) */
  bagMaking: {
    三边封袋: 30,
    自立袋: 30,
    风琴袋: 30,
    中封袋: 30,
    八边封袋: 60,
  } as Record<BagType, number>,

  /** 异形工艺:在制袋费基础上叠加(元/个),按袋型家族;尺寸按外接矩形计 */
  shaped: { normal: 60, eightSide: 90 } as Record<BagFamily, number>,

  /** 牛皮纸开窗(元/个),按袋型家族 */
  window: { normal: 60, eightSide: 90 } as Record<BagFamily, number>,

  /** 牛皮纸开窗仅此材质可选 */
  windowRequiresMaterial: '牛皮' as Material,

  /** 开窗处表面与袋子整体表面不一致:元/个 */
  surfaceMismatch: 80,

  /** 拉链:不另加价,仅限以下袋型可选 */
  zipper: {
    price: 0,
    allowed: ['三边封袋', '自立袋', '八边封袋'] as BagType[],
  },

  /** 嘴:25元/个,不足3个按3个计 */
  spout: { price: 25, minQty: 3 },

  /** 气阀:10元/个,不足2个按2个计 */
  valve: { price: 10, minQty: 2 },

  /**
   * 数量折扣档(按单款数量,作用于全部费用)。
   * cancelableByTinyBag:该档折扣受特小袋规则限制(命中特小袋时此档不打折)。
   */
  discountTiers: [
    { min: 5, max: 9, rate: 0.9, label: '5-9个 9折', cancelableByTinyBag: true },
    { min: 10, max: 19, rate: 0.8, label: '10-19个 8折' },
    { min: 20, max: 49, rate: 0.7, label: '20-49个 7折' },
    { min: 50, max: 99, rate: 0.6, label: '50-99个 6折' },
    { min: 100, max: Infinity, rate: 0.5, label: '100个及以上 5折' },
  ] as { min: number; max: number; rate: number; label: string; cancelableByTinyBag?: boolean }[],

  /**
   * 特小袋规则(2026-07-23 澄清):单袋印刷费低于 11 元的袋子,
   * 在(折前)总印刷费低于 100 元(低消范围内)时,仅 9 折档(5-9个)不打折;
   * 满足 8 折及更低折扣条件时照常打折。
   */
  tinyBag: { perBagPrintFeeBelow: 11, totalPrintFeeBelow: 100 },

  /** 复制报价文本末尾的固定文案 */
  quoteFooter: '以上为打样费用,不含税运,最终以实际确认为准。',
}

/**
 * 展开面积(mm²),输入尺寸单位 mm。异形工艺按外接矩形尺寸,套用同袋型公式。
 * (2026-07-23 按工厂公式更新,单位统一为 mm)
 * 三边封袋:宽 × 高 × 2
 * 自立袋:宽 × (高 + 底风琴/2) × 2
 * 风琴袋:(宽 + 侧风琴 + 10) × 高 × 2
 * 中封袋:(宽 + 10) × 高 × 2
 * 八边封袋:(宽 + 侧风琴) × 高 × 2 + 宽 × 侧风琴(底)
 */
export function spreadAreaMm2(
  bagType: BagType,
  widthMm: number,
  heightMm: number,
  gussetMm: number,
): number {
  switch (bagType) {
    case '三边封袋':
      return widthMm * heightMm * 2
    case '自立袋':
      return widthMm * (heightMm + gussetMm / 2) * 2
    case '风琴袋':
      return (widthMm + gussetMm + 10) * heightMm * 2
    case '中封袋':
      return (widthMm + 10) * heightMm * 2
    case '八边封袋':
      return (widthMm + gussetMm) * heightMm * 2 + widthMm * gussetMm
  }
}
