/**
 * 报价引擎:纯函数,框架无关,网页版与小程序共用。
 * 内部以"分"(cents)为整数单位计算,避免浮点误差;最终总价四舍五入到元。
 */
import { BAG_FAMILY, RULES, spreadAreaMm2, surfaceFinish } from './rules'
import type { BagType, Finish, Surface } from './rules'

export type { BagType, Finish, Surface }

export interface QuoteInput {
  bagType: BagType
  /** 宽 mm(异形时为外接矩形宽) */
  widthMm: number
  /** 高 mm */
  heightMm: number
  /** 自立系=底风琴;风琴袋/八边封系=侧风琴;三边封系/中封袋不使用(单位 mm) */
  gussetMm: number
  /** 单款数量 */
  quantity: number
  /** 袋子整体表面(材质+光泽) */
  surface: Surface
  /** 异形工艺(价格叠加,尺寸按外接矩形) */
  shaped: boolean
  /** 牛皮纸开窗 */
  window: boolean
  /** 开窗处表面光泽(仅开窗时有效;与整体光泽不一致时 +80元/个) */
  windowSurface: Finish
  /** 嘴 */
  spout: boolean
  /** 气阀 */
  valve: boolean
}

export interface FeeLine {
  /** 费用名,如"印刷费" */
  label: string
  /** 计算过程说明,如"600元/㎡ × 0.6㎡" */
  detail: string
  /** 金额(分) */
  cents: number
}

export interface QuoteResult {
  /** ok=线上报价;manual=需人工报价(当前规则下暂无,保留能力) */
  status: 'ok' | 'manual'
  manualReasons: string[]
  /** 单袋展开面积 ㎡ */
  areaPerBagM2: number
  /** 总印刷面积 ㎡ */
  totalAreaM2: number
  /** 是否触发100元印刷低消 */
  minChargeApplied: boolean
  /** 费用明细行 */
  lines: FeeLine[]
  /** 折前小计(分) */
  subtotalCents: number
  /** 折扣率:1 / 0.9 / 0.8 / 0.7 / 0.6 / 0.5 */
  discountRate: number
  /** 折扣说明,如"10-19个 8折" */
  discountLabel: string
  /** 是否因特小袋规则取消9折(仅9折档受影响,8折及以上照常) */
  tinyBagNoDiscount: boolean
  /** 应收总价(元,四舍五入) */
  totalYuan: number
}

export class QuoteInputError extends Error {}

function assertInput(input: QuoteInput): void {
  const { widthMm, heightMm, gussetMm, quantity } = input
  if (!(widthMm > 0) || !(heightMm > 0)) {
    throw new QuoteInputError('请填写有效的宽和高(大于0)')
  }
  if (!(gussetMm >= 0)) {
    throw new QuoteInputError('风琴尺寸不能为负数')
  }
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new QuoteInputError('数量必须是不小于1的整数')
  }
}

/** 元 → 分(规则表中的单价都是整数元,直接乘100) */
const yuan = (n: number) => Math.round(n * 100)

export function quote(input: QuoteInput): QuoteResult {
  assertInput(input)
  const { bagType, widthMm, heightMm, gussetMm, quantity, surface } = input
  const family = BAG_FAMILY[bagType]

  const areaPerBagM2 = spreadAreaMm2(bagType, widthMm, heightMm, gussetMm) / 1_000_000
  const totalAreaM2 = areaPerBagM2 * quantity

  const lines: FeeLine[] = []

  // 印刷费:600元/㎡,低消100元
  const perBagPrintCents = Math.round(RULES.printing.pricePerM2 * areaPerBagM2 * 100)
  const rawPrintCents = Math.round(RULES.printing.pricePerM2 * totalAreaM2 * 100)
  const minChargeCents = yuan(RULES.printing.minCharge)
  const minChargeApplied = rawPrintCents < minChargeCents
  const printCents = Math.max(rawPrintCents, minChargeCents)
  lines.push({
    label: '印刷费',
    detail: minChargeApplied
      ? `${RULES.printing.pricePerM2}元/㎡ × ${fmtArea(totalAreaM2)}㎡ = ${fmtCents(rawPrintCents)}元,不足按低消${RULES.printing.minCharge}元计`
      : `${RULES.printing.pricePerM2}元/㎡ × ${fmtArea(totalAreaM2)}㎡`,
    cents: printCents,
  })

  // 复合制袋费(拉链袋型同价,拉链不另加钱)
  const bagUnit = RULES.bagMaking[bagType]
  lines.push({
    label: '复合制袋费',
    detail: `${bagUnit}元/个 × ${quantity}`,
    cents: yuan(bagUnit) * quantity,
  })

  // 异形工艺:制袋费基础上叠加,普通袋系60/八边封系90
  if (input.shaped) {
    const shapedUnit = RULES.shaped[family]
    lines.push({
      label: '异形',
      detail: `${shapedUnit}元/个 × ${quantity}`,
      cents: yuan(shapedUnit) * quantity,
    })
  }

  // 牛皮纸开窗 + 开窗处光泽与整体不一致加价
  if (input.window) {
    const windowUnit = RULES.window[family]
    lines.push({
      label: '牛皮纸开窗',
      detail: `${windowUnit}元/个 × ${quantity}`,
      cents: yuan(windowUnit) * quantity,
    })
    if (input.windowSurface !== surfaceFinish(surface)) {
      lines.push({
        label: `开窗处${input.windowSurface}(与整体${surface}不一致)`,
        detail: `${RULES.surfaceMismatch}元/个 × ${quantity}`,
        cents: yuan(RULES.surfaceMismatch) * quantity,
      })
    }
  }

  // 嘴:不足最低数量按最低数量计费
  if (input.spout) {
    const billQty = Math.max(quantity, RULES.spout.minQty)
    lines.push({
      label: '嘴',
      detail:
        billQty > quantity
          ? `${RULES.spout.price}元/个,不足${RULES.spout.minQty}个按${RULES.spout.minQty}个计`
          : `${RULES.spout.price}元/个 × ${quantity}`,
      cents: yuan(RULES.spout.price) * billQty,
    })
  }

  // 气阀:不足最低数量按最低数量计费
  if (input.valve) {
    const billQty = Math.max(quantity, RULES.valve.minQty)
    lines.push({
      label: '气阀',
      detail:
        billQty > quantity
          ? `${RULES.valve.price}元/个,不足${RULES.valve.minQty}个按${RULES.valve.minQty}个计`
          : `${RULES.valve.price}元/个 × ${quantity}`,
      cents: yuan(RULES.valve.price) * billQty,
    })
  }

  const subtotalCents = lines.reduce((sum, l) => sum + l.cents, 0)

  // 数量折扣;特小袋在低消范围内仅9折档失效,8折及以上照常
  const tinyBag =
    perBagPrintCents < yuan(RULES.tinyBag.perBagPrintFeeBelow) &&
    rawPrintCents < yuan(RULES.tinyBag.totalPrintFeeBelow)
  let discountRate = 1
  let discountLabel = '1-4个 不打折'
  let tinyBagNoDiscount = false
  const tier = RULES.discountTiers.find((t) => quantity >= t.min && quantity <= t.max)
  if (tier) {
    if (tinyBag && tier.cancelableByTinyBag) {
      tinyBagNoDiscount = true
      discountLabel = '特小袋低消范围内,不打9折'
    } else {
      discountRate = tier.rate
      discountLabel = tier.label
    }
  }

  const totalYuan = Math.round((subtotalCents * discountRate) / 100)

  return {
    status: 'ok',
    manualReasons: [],
    areaPerBagM2,
    totalAreaM2,
    minChargeApplied,
    lines,
    subtotalCents,
    discountRate,
    discountLabel,
    tinyBagNoDiscount,
    totalYuan,
  }
}

/** 分 → 元字符串,去掉多余的0,如 107520 → "1075.2" */
export function fmtCents(cents: number): string {
  return (cents / 100).toFixed(2).replace(/\.?0+$/, '')
}

/** 面积显示:保留4位小数,去掉多余的0 */
export function fmtArea(m2: number): string {
  return m2.toFixed(4).replace(/\.?0+$/, '')
}
