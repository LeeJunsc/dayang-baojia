import { describe, expect, it } from 'vitest'
import { QuoteInputError, quote } from './quote'
import type { QuoteInput } from './quote'
import { buildQuoteText } from './quoteText'
import { spreadAreaCm2 } from './rules'

/** 基准输入:普通袋 15×20cm 无风琴 哑面 无工艺 */
function base(over: Partial<QuoteInput> = {}): QuoteInput {
  return {
    bagType: '普通袋',
    widthCm: 15,
    heightCm: 20,
    gussetCm: 0,
    quantity: 1,
    surface: '哑面',
    window: false,
    windowSurface: '哑面',
    spout: false,
    valve: false,
    ...over,
  }
}

describe('展开面积公式', () => {
  it('普通袋:宽×(高+底风琴)×2', () => {
    expect(spreadAreaCm2('普通袋', 15, 20, 0)).toBe(600)
    expect(spreadAreaCm2('普通袋', 15, 20, 4)).toBe(15 * 24 * 2)
    expect(spreadAreaCm2('异型普通袋', 15, 20, 4)).toBe(15 * 24 * 2)
  })
  it('八边封:(宽+侧风琴)×高×2 + 宽×侧风琴', () => {
    expect(spreadAreaCm2('八边封袋', 16, 24, 8)).toBe((16 + 8) * 24 * 2 + 16 * 8) // 1280
    expect(spreadAreaCm2('异型八边封', 16, 24, 8)).toBe(1280)
  })
})

describe('印刷费与低消', () => {
  it('低于100元按低消100元计', () => {
    // 0.06㎡ × 600 = 36元 → 低消100
    const r = quote(base())
    expect(r.minChargeApplied).toBe(true)
    expect(r.lines[0].cents).toBe(100_00)
    // 总价 = 100 + 30 = 130
    expect(r.totalYuan).toBe(130)
  })
  it('超过100元按实际面积计', () => {
    // 0.06㎡ × 10个 = 0.6㎡ × 600 = 360元
    const r = quote(base({ quantity: 10 }))
    expect(r.minChargeApplied).toBe(false)
    expect(r.lines[0].cents).toBe(360_00)
  })
  it('恰好100元不算触发低消', () => {
    // 面积凑 1/6㎡:普通袋 宽 41.6667 会有浮点;改用 12.5×(20+0)×2=500cm²=0.05㎡ → 30元/个,qty=? 凑整100:
    // 用 10×25×2 = 500cm²(0.05㎡)= 30元/个 → 不整。直接用 1㎡ 总面积:25×20×2=1000cm²=0.1㎡ → 60元/个,qty=? 不到100。
    // 简化:单袋 0.1㎡=60元,2个=120元 ≥ 100,不触发。
    const r = quote(base({ widthCm: 25, heightCm: 20, quantity: 2 }))
    expect(r.minChargeApplied).toBe(false)
    expect(r.lines[0].cents).toBe(120_00)
  })
})

describe('复合制袋费', () => {
  it.each([
    ['普通袋', 30],
    ['异型普通袋', 60],
    ['八边封袋', 60],
    ['异型八边封', 90],
  ] as const)('%s %d元/个', (bagType, unit) => {
    const r = quote(base({ bagType, gussetCm: bagType.includes('八边封') ? 8 : 0, quantity: 10 }))
    const line = r.lines.find((l) => l.label === '复合制袋费')!
    expect(line.cents).toBe(unit * 10 * 100)
  })
})

describe('开窗与表面', () => {
  it('普通袋开窗60元/个,八边封90元/个', () => {
    const r1 = quote(base({ window: true, quantity: 10 }))
    expect(r1.lines.find((l) => l.label === '牛皮纸开窗')!.cents).toBe(60 * 10 * 100)
    const r2 = quote(base({ bagType: '八边封袋', gussetCm: 8, window: true, quantity: 10 }))
    expect(r2.lines.find((l) => l.label === '牛皮纸开窗')!.cents).toBe(90 * 10 * 100)
  })
  it('开窗处表面与整体一致:不加价', () => {
    const r = quote(base({ window: true, surface: '哑面', windowSurface: '哑面', quantity: 10 }))
    expect(r.lines.some((l) => l.label.includes('不一致'))).toBe(false)
  })
  it('开窗处表面与整体不一致:+80元/个', () => {
    const r = quote(base({ window: true, surface: '哑面', windowSurface: '亮面', quantity: 10 }))
    const line = r.lines.find((l) => l.label.includes('不一致'))!
    expect(line.cents).toBe(80 * 10 * 100)
  })
  it('未开窗时表面不一致不加价', () => {
    const r = quote(base({ window: false, surface: '哑面', windowSurface: '亮面', quantity: 10 }))
    expect(r.lines.some((l) => l.label.includes('不一致'))).toBe(false)
  })
})

describe('嘴与气阀(最低计费数量)', () => {
  it('嘴:1个按3个计=75元;3个=75元;4个=100元', () => {
    expect(quote(base({ spout: true, quantity: 1 })).lines.find((l) => l.label === '嘴')!.cents).toBe(75_00)
    expect(quote(base({ spout: true, quantity: 3 })).lines.find((l) => l.label === '嘴')!.cents).toBe(75_00)
    expect(quote(base({ spout: true, quantity: 4 })).lines.find((l) => l.label === '嘴')!.cents).toBe(100_00)
  })
  it('气阀:1个按2个计=20元;2个=20元;5个=50元', () => {
    expect(quote(base({ valve: true, quantity: 1 })).lines.find((l) => l.label === '气阀')!.cents).toBe(20_00)
    expect(quote(base({ valve: true, quantity: 2 })).lines.find((l) => l.label === '气阀')!.cents).toBe(20_00)
    expect(quote(base({ valve: true, quantity: 5 })).lines.find((l) => l.label === '气阀')!.cents).toBe(50_00)
  })
})

describe('数量折扣档(15×20普通袋,单袋印刷36元,非特小袋)', () => {
  it.each([
    [1, 1],
    [4, 1],
    [5, 0.9],
    [9, 0.9],
    [10, 0.8],
    [19, 0.8],
    [20, 0.7],
    [49, 0.7],
    [50, 0.6],
    [99, 0.6],
    [100, 0.5],
    [500, 0.5],
  ])('%d个 → 折扣%d', (qty, rate) => {
    expect(quote(base({ quantity: qty })).discountRate).toBe(rate)
  })

  it('折扣作用于全部费用(印刷+制袋+开窗+加价项)', () => {
    // 八边封 16×24+8,qty20,开窗+不一致+嘴+气阀
    // 面积1280cm²=0.128㎡ → 印刷 600×0.128×20 = 1536
    // 制袋 60×20=1200;开窗 90×20=1800;不一致 80×20=1600;嘴 25×20=500;气阀 10×20=200
    // 小计 6836 × 0.7 = 4785.2 → 4785
    const r = quote(
      base({
        bagType: '八边封袋',
        widthCm: 16,
        heightCm: 24,
        gussetCm: 8,
        quantity: 20,
        surface: '哑面',
        window: true,
        windowSurface: '亮面',
        spout: true,
        valve: true,
      }),
    )
    expect(r.subtotalCents).toBe(6836_00)
    expect(r.discountRate).toBe(0.7)
    expect(r.totalYuan).toBe(4785)
  })

  it('非特小袋(单袋印刷≥11元)触发低消仍正常打折', () => {
    // 12.5×10×2=250cm²=0.025㎡ → 单袋印刷15元;6个=90元<100 → 低消,但仍9折
    const r = quote(base({ widthCm: 12.5, heightCm: 10, quantity: 6 }))
    expect(r.minChargeApplied).toBe(true)
    expect(r.tinyBagNoDiscount).toBe(false)
    expect(r.discountRate).toBe(0.9)
    // 小计 = 100 + 30×6 = 280 × 0.9 = 252
    expect(r.totalYuan).toBe(252)
  })
})

describe('特小袋规则(单袋印刷费<11元)', () => {
  // 10×8cm 普通袋:160cm²=0.016㎡ → 单袋印刷 9.6 元
  const tiny = { widthCm: 10, heightCm: 8 }

  it('低消范围内(总印刷<100)不打折', () => {
    // 5个:9.6×5=48<100 → 不打折
    const r = quote(base({ ...tiny, quantity: 5 }))
    expect(r.tinyBagNoDiscount).toBe(true)
    expect(r.discountRate).toBe(1)
    // 100 + 30×5 = 250
    expect(r.totalYuan).toBe(250)
  })
  it('10个仍在低消内(96<100)照样不打折', () => {
    const r = quote(base({ ...tiny, quantity: 10 }))
    expect(r.tinyBagNoDiscount).toBe(true)
    expect(r.discountRate).toBe(1)
  })
  it('总印刷≥100后折扣恢复', () => {
    // 11个:9.6×11=105.6 ≥ 100 → 8折
    const r = quote(base({ ...tiny, quantity: 11 }))
    expect(r.tinyBagNoDiscount).toBe(false)
    expect(r.discountRate).toBe(0.8)
    // 小计 105.6 + 330 = 435.6 × 0.8 = 348.48 → 348
    expect(r.totalYuan).toBe(348)
  })
})

describe('金额取整:折后四舍五入到元', () => {
  it('348.48 → 348', () => {
    const r = quote(base({ widthCm: 10, heightCm: 8, quantity: 11 }))
    expect(r.totalYuan).toBe(348)
  })
  it('4785.2 → 4785', () => {
    const r = quote(
      base({
        bagType: '八边封袋',
        widthCm: 16,
        heightCm: 24,
        gussetCm: 8,
        quantity: 20,
        window: true,
        windowSurface: '亮面',
        spout: true,
        valve: true,
      }),
    )
    expect(r.totalYuan).toBe(4785)
  })
})

describe('输入校验', () => {
  it('宽高必须大于0', () => {
    expect(() => quote(base({ widthCm: 0 }))).toThrow(QuoteInputError)
    expect(() => quote(base({ heightCm: -1 }))).toThrow(QuoteInputError)
  })
  it('数量必须是不小于1的整数', () => {
    expect(() => quote(base({ quantity: 0 }))).toThrow(QuoteInputError)
    expect(() => quote(base({ quantity: 2.5 }))).toThrow(QuoteInputError)
  })
  it('风琴不能为负', () => {
    expect(() => quote(base({ gussetCm: -1 }))).toThrow(QuoteInputError)
  })
})

describe('报价文本', () => {
  it('单款含明细、折扣、文案', () => {
    const input = base({ quantity: 10, window: true, windowSurface: '亮面' })
    const text = buildQuoteText([{ input, result: quote(input) }], new Date('2026-07-22'))
    expect(text).toContain('【打样报价】2026-07-22')
    expect(text).toContain('第1款 普通袋 15×20cm 哑面 / 开窗(亮面) × 10个')
    expect(text).toContain('印刷费')
    expect(text).toContain('10-19个 8折')
    expect(text).toContain('以上为打样费用,不含税运,最终以实际确认为准。')
    // 单款不出现"合计应收"
    expect(text).not.toContain('合计应收')
  })
  it('多款出现合计', () => {
    const a = base({ quantity: 10 })
    const b = base({ bagType: '八边封袋', gussetCm: 8, quantity: 5 })
    const text = buildQuoteText([
      { input: a, result: quote(a) },
      { input: b, result: quote(b) },
    ])
    expect(text).toContain('第2款')
    expect(text).toContain('合计应收')
  })
})
