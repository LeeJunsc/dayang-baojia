import { describe, expect, it } from 'vitest'
import { QuoteInputError, quote } from './quote'
import type { QuoteInput } from './quote'
import { buildQuoteText } from './quoteText'
import { spreadAreaMm2 } from './rules'

/** 基准输入:三边封袋 150×200mm OPP哑面 无工艺 */
function base(over: Partial<QuoteInput> = {}): QuoteInput {
  return {
    bagType: '三边封袋',
    widthMm: 150,
    heightMm: 200,
    gussetMm: 0,
    quantity: 1,
    surface: 'OPP哑面',
    shaped: false,
    window: false,
    windowSurface: '哑面',
    spout: false,
    valve: false,
    ...over,
  }
}

describe('展开面积公式(单位mm;拉链变体与基础袋型同公式)', () => {
  it('三边封系:宽×高×2(无风琴)', () => {
    expect(spreadAreaMm2('三边封袋', 150, 200, 0)).toBe(60000)
    expect(spreadAreaMm2('三边封拉链袋', 150, 200, 0)).toBe(60000)
    // 无风琴袋型忽略风琴值
    expect(spreadAreaMm2('三边封袋', 150, 200, 99)).toBe(60000)
  })
  it('自立系:宽×(高+底风琴/2)×2', () => {
    for (const t of ['自立袋', '自立拉链袋', '自立单面拉链袋'] as const) {
      expect(spreadAreaMm2(t, 150, 200, 40)).toBe(150 * 220 * 2) // 66000
    }
  })
  it('风琴袋:(宽+侧风琴+10)×高×2', () => {
    expect(spreadAreaMm2('风琴袋', 150, 200, 40)).toBe(200 * 200 * 2) // 80000
  })
  it('中封袋:(宽+10)×高×2', () => {
    expect(spreadAreaMm2('中封袋', 150, 200, 0)).toBe(160 * 200 * 2) // 64000
  })
  it('八边封系:(宽+侧风琴)×高×2 + 宽×侧风琴', () => {
    for (const t of ['八边封袋(无拉链)', '八边封拉链袋', '八边封单面拉链袋'] as const) {
      expect(spreadAreaMm2(t, 160, 240, 80)).toBe((160 + 80) * 240 * 2 + 160 * 80) // 128000
    }
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
  it('达到100元不算触发低消', () => {
    // 250×200mm → 100000mm²=0.1㎡ → 60元/个,2个=120元 ≥ 100
    const r = quote(base({ widthMm: 250, heightMm: 200, quantity: 2 }))
    expect(r.minChargeApplied).toBe(false)
    expect(r.lines[0].cents).toBe(120_00)
  })
})

describe('复合制袋费与异形叠加', () => {
  it.each([
    ['三边封袋', 30],
    ['三边封拉链袋', 30],
    ['自立袋', 30],
    ['自立拉链袋', 30],
    ['自立单面拉链袋', 30],
    ['风琴袋', 30],
    ['中封袋', 30],
    ['八边封袋(无拉链)', 60],
    ['八边封拉链袋', 60],
    ['八边封单面拉链袋', 60],
  ] as const)('%s %d元/个', (bagType, unit) => {
    const r = quote(base({ bagType, quantity: 10 }))
    const line = r.lines.find((l) => l.label === '复合制袋费')!
    expect(line.cents).toBe(unit * 10 * 100)
  })

  it('拉链袋型与基础袋型同价(拉链不另加钱)', () => {
    expect(quote(base({ bagType: '三边封拉链袋', quantity: 10 })).totalYuan).toBe(
      quote(base({ bagType: '三边封袋', quantity: 10 })).totalYuan,
    )
    expect(
      quote(base({ bagType: '八边封拉链袋', gussetMm: 80, quantity: 10 })).totalYuan,
    ).toBe(quote(base({ bagType: '八边封袋(无拉链)', gussetMm: 80, quantity: 10 })).totalYuan)
  })

  it('异形工艺叠加:普通袋系+60元/个,八边封系+90元/个', () => {
    // 普通袋系:制袋30 + 异形60 = 90元/个
    const r = quote(base({ shaped: true, quantity: 10 }))
    expect(r.lines.find((l) => l.label === '复合制袋费')!.cents).toBe(30 * 10 * 100)
    expect(r.lines.find((l) => l.label === '异形')!.cents).toBe(60 * 10 * 100)
    // 八边封系:制袋60 + 异形90 = 150元/个
    const r8 = quote(base({ bagType: '八边封拉链袋', gussetMm: 80, shaped: true, quantity: 10 }))
    expect(r8.lines.find((l) => l.label === '复合制袋费')!.cents).toBe(60 * 10 * 100)
    expect(r8.lines.find((l) => l.label === '异形')!.cents).toBe(90 * 10 * 100)
  })

  it('不选异形则无异形费用行', () => {
    expect(quote(base()).lines.some((l) => l.label === '异形')).toBe(false)
  })
})

describe('开窗与表面(不一致只比较亮/哑光泽)', () => {
  it('普通袋系开窗60元/个,八边封系90元/个', () => {
    for (const bagType of ['三边封袋', '自立拉链袋', '风琴袋', '中封袋'] as const) {
      const r = quote(base({ bagType, window: true, quantity: 10 }))
      expect(r.lines.find((l) => l.label === '牛皮纸开窗')!.cents).toBe(60 * 10 * 100)
    }
    for (const bagType of ['八边封袋(无拉链)', '八边封单面拉链袋'] as const) {
      const r = quote(base({ bagType, gussetMm: 80, window: true, quantity: 10 }))
      expect(r.lines.find((l) => l.label === '牛皮纸开窗')!.cents).toBe(90 * 10 * 100)
    }
  })
  it('开窗处光泽与整体一致:不加价', () => {
    const r1 = quote(base({ surface: 'OPP哑面', window: true, windowSurface: '哑面', quantity: 10 }))
    expect(r1.lines.some((l) => l.label.includes('不一致'))).toBe(false)
    const r2 = quote(base({ surface: 'PET亮面', window: true, windowSurface: '亮面', quantity: 10 }))
    expect(r2.lines.some((l) => l.label.includes('不一致'))).toBe(false)
  })
  it('开窗处光泽与整体不一致:+80元/个', () => {
    const r1 = quote(base({ surface: 'OPP哑面', window: true, windowSurface: '亮面', quantity: 10 }))
    expect(r1.lines.find((l) => l.label.includes('不一致'))!.cents).toBe(80 * 10 * 100)
    const r2 = quote(base({ surface: 'PET亮面', window: true, windowSurface: '哑面', quantity: 10 }))
    expect(r2.lines.find((l) => l.label.includes('不一致'))!.cents).toBe(80 * 10 * 100)
  })
  it('未开窗时表面不一致不加价', () => {
    const r = quote(base({ window: false, surface: 'OPP哑面', windowSurface: '亮面', quantity: 10 }))
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

describe('数量折扣档(150×200三边封,单袋印刷36元,非特小袋)', () => {
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

  it('折扣作用于全部费用(印刷+制袋+异形+开窗+加价项)', () => {
    // 八边封拉链袋 160×240+80mm,qty20,异形+开窗+光泽不一致+嘴+气阀
    // 面积128000mm²=0.128㎡ → 印刷 600×0.128×20 = 1536
    // 制袋 60×20=1200;异形 90×20=1800;开窗 90×20=1800;不一致 80×20=1600
    // 嘴 25×20=500;气阀 10×20=200
    // 小计 8636 × 0.7 = 6045.2 → 6045
    const r = quote(
      base({
        bagType: '八边封拉链袋',
        widthMm: 160,
        heightMm: 240,
        gussetMm: 80,
        quantity: 20,
        surface: 'OPP哑面',
        shaped: true,
        window: true,
        windowSurface: '亮面',
        spout: true,
        valve: true,
      }),
    )
    expect(r.subtotalCents).toBe(8636_00)
    expect(r.discountRate).toBe(0.7)
    expect(r.totalYuan).toBe(6045)
  })

  it('非特小袋(单袋印刷≥11元)触发低消仍正常打折', () => {
    // 125×100mm → 25000mm²=0.025㎡ → 单袋印刷15元;6个=90元<100 → 低消,但仍9折
    const r = quote(base({ widthMm: 125, heightMm: 100, quantity: 6 }))
    expect(r.minChargeApplied).toBe(true)
    expect(r.tinyBagNoDiscount).toBe(false)
    expect(r.discountRate).toBe(0.9)
    // 小计 = 100 + 30×6 = 280 × 0.9 = 252
    expect(r.totalYuan).toBe(252)
  })
})

describe('特小袋规则(单袋印刷费<11元,低消内仅9折档失效)', () => {
  // 100×80mm 三边封:16000mm²=0.016㎡ → 单袋印刷 9.6 元
  const tiny = { widthMm: 100, heightMm: 80 }

  it('5个(9折档)低消范围内:不打折', () => {
    const r = quote(base({ ...tiny, quantity: 5 }))
    expect(r.tinyBagNoDiscount).toBe(true)
    expect(r.discountRate).toBe(1)
    expect(r.discountLabel).toBe('特小袋低消范围内,不打9折')
    // 100 + 30×5 = 250
    expect(r.totalYuan).toBe(250)
  })
  it('9个(9折档上界)低消范围内:不打折', () => {
    // 9.6×9=86.4 < 100
    const r = quote(base({ ...tiny, quantity: 9 }))
    expect(r.tinyBagNoDiscount).toBe(true)
    expect(r.discountRate).toBe(1)
    // 100 + 30×9 = 370
    expect(r.totalYuan).toBe(370)
  })
  it('10个满足8折条件:即使低消内(96<100)依然打8折', () => {
    const r = quote(base({ ...tiny, quantity: 10 }))
    expect(r.tinyBagNoDiscount).toBe(false)
    expect(r.discountRate).toBe(0.8)
    // 印刷按低消100 + 制袋300 = 400 × 0.8 = 320
    expect(r.totalYuan).toBe(320)
  })
  it('总印刷≥100后各档照常', () => {
    // 11个:9.6×11=105.6 ≥ 100 → 8折
    const r = quote(base({ ...tiny, quantity: 11 }))
    expect(r.tinyBagNoDiscount).toBe(false)
    expect(r.discountRate).toBe(0.8)
    // 小计 105.6 + 330 = 435.6 × 0.8 = 348.48 → 348
    expect(r.totalYuan).toBe(348)
  })
  it('非特小袋(单袋印刷≥11元)5-9个照常打9折', () => {
    // 125×100mm → 单袋印刷15元;6个 → 9折
    const r = quote(base({ widthMm: 125, heightMm: 100, quantity: 6 }))
    expect(r.tinyBagNoDiscount).toBe(false)
    expect(r.discountRate).toBe(0.9)
  })
})

describe('金额取整:折后四舍五入到元', () => {
  it('348.48 → 348', () => {
    expect(quote(base({ widthMm: 100, heightMm: 80, quantity: 11 })).totalYuan).toBe(348)
  })
  it('6045.2 → 6045', () => {
    const r = quote(
      base({
        bagType: '八边封拉链袋',
        widthMm: 160,
        heightMm: 240,
        gussetMm: 80,
        quantity: 20,
        surface: 'OPP哑面',
        shaped: true,
        window: true,
        windowSurface: '亮面',
        spout: true,
        valve: true,
      }),
    )
    expect(r.totalYuan).toBe(6045)
  })
})

describe('输入校验', () => {
  it('宽高必须大于0', () => {
    expect(() => quote(base({ widthMm: 0 }))).toThrow(QuoteInputError)
    expect(() => quote(base({ heightMm: -1 }))).toThrow(QuoteInputError)
  })
  it('数量必须是不小于1的整数', () => {
    expect(() => quote(base({ quantity: 0 }))).toThrow(QuoteInputError)
    expect(() => quote(base({ quantity: 2.5 }))).toThrow(QuoteInputError)
  })
  it('风琴不能为负', () => {
    expect(() => quote(base({ gussetMm: -1 }))).toThrow(QuoteInputError)
  })
})

describe('报价文本', () => {
  it('单款含款式、小计折扣、应收、文案,不含计算参数', () => {
    const input = base({
      bagType: '三边封拉链袋',
      quantity: 10,
      shaped: true,
      window: true,
      windowSurface: '亮面',
    })
    const text = buildQuoteText([{ input, result: quote(input) }], new Date('2026-07-22'))
    expect(text).toContain('【打样报价】2026-07-22')
    expect(text).toContain('第1款 三边封拉链袋 150×200mm OPP哑面 / 异形 / 开窗(亮面) × 10个')
    expect(text).toContain('10-19个 8折')
    expect(text).toContain('本款应收')
    expect(text).toContain('以上为打样费用,不含税运,最终以实际确认为准。')
    // 客户不需要看到的计算参数
    expect(text).not.toContain('展开面积')
    expect(text).not.toContain('印刷费')
    expect(text).not.toContain('复合制袋费')
    expect(text).not.toContain('元/㎡')
    expect(text).not.toContain('合计应收')
  })
  it('开窗处光泽与整体一致时描述只写"开窗"', () => {
    const input = base({ surface: 'PET亮面', window: true, windowSurface: '亮面', quantity: 5 })
    const text = buildQuoteText([{ input, result: quote(input) }])
    expect(text).toContain('PET亮面 / 开窗 ×')
    expect(text).not.toContain('开窗(')
  })
  it('多款出现合计', () => {
    const a = base({ quantity: 10 })
    const b = base({ bagType: '八边封袋(无拉链)', gussetMm: 80, quantity: 5 })
    const text = buildQuoteText([
      { input: a, result: quote(a) },
      { input: b, result: quote(b) },
    ])
    expect(text).toContain('第2款')
    expect(text).toContain('合计应收')
  })
})
