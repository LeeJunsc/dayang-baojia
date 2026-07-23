/**
 * 生成发给客户的报价文本(一键复制用)。
 */
import { RULES } from './rules'
import { fmtCents } from './quote'
import type { QuoteInput, QuoteResult } from './quote'

export interface QuotedItem {
  input: QuoteInput
  result: QuoteResult
}

function sizeText(input: QuoteInput): string {
  const g = input.gussetCm > 0 ? `+${input.gussetCm}` : ''
  return `${input.widthCm}×${input.heightCm}${g}cm`
}

function craftText(input: QuoteInput): string {
  const parts: string[] = [input.surface]
  if (input.shaped) parts.push('异形')
  if (input.window) {
    parts.push(input.windowSurface === input.surface ? '开窗' : `开窗(${input.windowSurface})`)
  }
  if (input.zipper) parts.push('拉链')
  if (input.spout) parts.push('嘴')
  if (input.valve) parts.push('气阀')
  return parts.join(' / ')
}

export function buildQuoteText(items: QuotedItem[], date = new Date()): string {
  const d = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  const out: string[] = [`【打样报价】${d}`]

  items.forEach(({ input, result }, i) => {
    out.push('')
    out.push(`第${i + 1}款 ${input.bagType} ${sizeText(input)} ${craftText(input)} × ${input.quantity}个`)
    out.push(`  小计 ${fmtCents(result.subtotalCents)}元,${result.discountLabel}`)
    out.push(`  本款应收:${result.totalYuan}元`)
  })

  if (items.length > 1) {
    const total = items.reduce((s, it) => s + it.result.totalYuan, 0)
    out.push('')
    out.push(`合计应收:${total}元`)
  }
  out.push('')
  out.push(RULES.quoteFooter)
  return out.join('\n')
}
