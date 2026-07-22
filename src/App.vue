<script setup lang="ts">
import { computed, ref } from 'vue'
import { QuoteInputError, fmtCents, quote } from './engine/quote'
import type { BagType, QuoteInput, QuoteResult, Surface } from './engine/quote'
import { buildQuoteText } from './engine/quoteText'
import { GUSSET_KIND, RULES } from './engine/rules'

const bagTypes: BagType[] = ['三边封袋', '自立袋', '风琴袋', '中封袋', '八边封袋']
const surfaces: Surface[] = ['亮面', '哑面']

function newItem(): QuoteInput {
  return {
    bagType: '三边封袋',
    widthCm: 15,
    heightCm: 20,
    gussetCm: 0,
    quantity: 1,
    surface: '哑面',
    shaped: false,
    window: false,
    windowSurface: '哑面',
    zipper: false,
    spout: false,
    valve: false,
  }
}

const items = ref<QuoteInput[]>([newItem()])

type ItemResult = { ok: true; result: QuoteResult } | { ok: false; error: string }

const results = computed<ItemResult[]>(() =>
  items.value.map((it) => {
    try {
      return { ok: true, result: quote({ ...it }) }
    } catch (e) {
      return { ok: false, error: e instanceof QuoteInputError ? e.message : '输入有误,请检查' }
    }
  }),
)

const allOk = computed(() => results.value.every((r) => r.ok))
const grandTotal = computed(() =>
  results.value.reduce((s, r) => (r.ok ? s + r.result.totalYuan : s), 0),
)

function hasGusset(item: QuoteInput): boolean {
  return GUSSET_KIND[item.bagType] !== 'none'
}

function gussetLabel(item: QuoteInput): string {
  return GUSSET_KIND[item.bagType] === 'bottom' ? '底风琴' : '侧风琴'
}

function zipperAllowed(item: QuoteInput): boolean {
  return RULES.zipper.allowed.includes(item.bagType)
}

function setBagType(item: QuoteInput, t: BagType) {
  item.bagType = t
  if (!hasGusset(item)) item.gussetCm = 0
  if (!zipperAllowed(item)) item.zipper = false
}

function toggleWindow(item: QuoteInput) {
  item.window = !item.window
  if (item.window) item.windowSurface = item.surface
}

function bump(item: QuoteInput, delta: number) {
  const q = Number.isFinite(item.quantity) ? item.quantity : 1
  item.quantity = Math.max(1, Math.round(q) + delta)
}

function addItem() {
  items.value.push(newItem())
}

function duplicateItem(i: number) {
  items.value.splice(i + 1, 0, { ...items.value[i] })
}

function removeItem(i: number) {
  items.value.splice(i, 1)
}

const toast = ref('')
let toastTimer: ReturnType<typeof setTimeout> | undefined

function showToast(msg: string) {
  toast.value = msg
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value = ''), 2200)
}

async function copyQuote() {
  if (!allOk.value) return
  const quoted = items.value.map((input, i) => ({
    input: { ...input },
    result: (results.value[i] as { ok: true; result: QuoteResult }).result,
  }))
  const text = buildQuoteText(quoted)
  try {
    await navigator.clipboard.writeText(text)
    showToast('报价文本已复制,可直接粘贴发给客户')
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
    showToast('报价文本已复制,可直接粘贴发给客户')
  }
}
</script>

<template>
  <div class="page">
    <header class="topbar">
      <h1>打样快速报价</h1>
      <span class="topbar-sub">复合袋 · A家</span>
    </header>

    <main class="items">
      <section v-for="(item, i) in items" :key="i" class="card">
        <div class="card-head">
          <span class="card-title">第{{ i + 1 }}款</span>
          <div class="card-actions">
            <button class="link" @click="duplicateItem(i)">复制此款</button>
            <button v-if="items.length > 1" class="link danger" @click="removeItem(i)">删除</button>
          </div>
        </div>

        <div class="field">
          <label class="field-label">袋型</label>
          <div class="seg grid3">
            <button
              v-for="t in bagTypes"
              :key="t"
              :class="{ on: item.bagType === t }"
              @click="setBagType(item, t)"
            >
              {{ t }}
            </button>
          </div>
        </div>

        <div class="field">
          <label class="field-label">
            尺寸 cm
            <span v-if="item.shaped" class="field-hint">异形填外接矩形尺寸</span>
          </label>
          <div class="dims">
            <div class="dim">
              <input v-model.number="item.widthCm" type="number" inputmode="decimal" min="0" />
              <span>宽</span>
            </div>
            <span class="dim-x">×</span>
            <div class="dim">
              <input v-model.number="item.heightCm" type="number" inputmode="decimal" min="0" />
              <span>高</span>
            </div>
            <template v-if="hasGusset(item)">
              <span class="dim-x">+</span>
              <div class="dim">
                <input v-model.number="item.gussetCm" type="number" inputmode="decimal" min="0" />
                <span>{{ gussetLabel(item) }}</span>
              </div>
            </template>
          </div>
        </div>

        <div class="field">
          <label class="field-label">整体表面</label>
          <div class="seg">
            <button
              v-for="s in surfaces"
              :key="s"
              :class="{ on: item.surface === s }"
              @click="item.surface = s"
            >
              {{ s }}
            </button>
          </div>
        </div>

        <div class="field">
          <label class="field-label">工艺</label>
          <div class="chips">
            <button class="chip" :class="{ on: item.shaped }" @click="item.shaped = !item.shaped">
              异形
            </button>
            <button class="chip" :class="{ on: item.window }" @click="toggleWindow(item)">
              牛皮纸开窗
            </button>
            <button
              v-if="zipperAllowed(item)"
              class="chip"
              :class="{ on: item.zipper }"
              @click="item.zipper = !item.zipper"
            >
              拉链
            </button>
            <button class="chip" :class="{ on: item.spout }" @click="item.spout = !item.spout">
              嘴
            </button>
            <button class="chip" :class="{ on: item.valve }" @click="item.valve = !item.valve">
              气阀
            </button>
          </div>
          <div v-if="item.window" class="subfield">
            <span class="sublabel">开窗处表面</span>
            <div class="seg small">
              <button
                v-for="s in surfaces"
                :key="s"
                :class="{ on: item.windowSurface === s }"
                @click="item.windowSurface = s"
              >
                {{ s }}
              </button>
            </div>
            <span v-if="item.windowSurface !== item.surface" class="mismatch">与整体不一致 +80元/个</span>
          </div>
        </div>

        <div class="field">
          <label class="field-label">数量</label>
          <div class="qty">
            <button class="qty-btn" @click="bump(item, -1)">−</button>
            <input v-model.number="item.quantity" type="number" inputmode="numeric" min="1" />
            <button class="qty-btn" @click="bump(item, 1)">+</button>
          </div>
        </div>

        <div v-if="results[i].ok" class="result">
          <div class="fee area-row">
            <span class="fee-name">展开面积</span>
            <span class="fee-amt light">
              {{ (results[i] as any).result.areaPerBagM2.toFixed(4).replace(/\.?0+$/, '') }}㎡/个 ×
              {{ item.quantity }}
            </span>
          </div>
          <div v-for="(line, li) in (results[i] as any).result.lines" :key="li" class="fee">
            <div class="fee-left">
              <span class="fee-name">{{ line.label }}</span>
              <span class="fee-detail">{{ line.detail }}</span>
            </div>
            <span class="fee-amt">{{ fmtCents(line.cents) }}元</span>
          </div>
          <div class="fee subtotal">
            <span class="fee-name">小计</span>
            <span class="fee-amt">{{ fmtCents((results[i] as any).result.subtotalCents) }}元</span>
          </div>
          <div class="fee">
            <span class="fee-name">折扣</span>
            <span
              class="badge"
              :class="(results[i] as any).result.tinyBagNoDiscount ? 'warn' : (results[i] as any).result.discountRate < 1 ? 'good' : ''"
            >
              {{ (results[i] as any).result.discountLabel }}
            </span>
          </div>
          <div class="item-total">
            <span>本款应收</span>
            <b>¥{{ (results[i] as any).result.totalYuan }}</b>
          </div>
        </div>
        <div v-else class="result error">{{ (results[i] as any).error }}</div>
      </section>

      <button class="add" @click="addItem">＋ 添加一款</button>
    </main>

    <footer class="bottombar">
      <div class="sum">
        <span class="sum-label">合计 {{ items.length }} 款</span>
        <span class="sum-amt">{{ allOk ? '¥' + grandTotal : '—' }}</span>
      </div>
      <button class="copy" :disabled="!allOk" @click="copyQuote">复制报价文本</button>
    </footer>

    <div class="toast" :class="{ show: toast }">{{ toast }}</div>
  </div>
</template>

<style>
.page {
  max-width: 560px;
  margin: 0 auto;
  padding: 0 14px calc(84px + env(safe-area-inset-bottom));
}

.topbar {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 18px 2px 12px;
}

.topbar h1 {
  font-size: 20px;
  font-weight: 700;
}

.topbar-sub {
  font-size: 13px;
  color: #7a8494;
}

.card {
  background: #fff;
  border-radius: 14px;
  padding: 16px 14px 14px;
  margin-bottom: 14px;
  box-shadow: 0 1px 3px rgba(16, 24, 40, 0.06);
}

.card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.card-title {
  font-weight: 700;
  font-size: 15px;
}

.card-actions {
  display: flex;
  gap: 14px;
}

.link {
  font-size: 13px;
  color: #0e7490;
}

.link.danger {
  color: #dc2626;
}

.field {
  margin-bottom: 14px;
}

.field-label {
  display: block;
  font-size: 13px;
  color: #667085;
  margin-bottom: 6px;
}

.field-hint {
  color: #b45309;
  margin-left: 6px;
}

.seg {
  display: flex;
  gap: 8px;
}

.seg button {
  flex: 1;
  padding: 9px 0;
  border-radius: 9px;
  background: #f2f4f7;
  border: 1px solid transparent;
  font-size: 14px;
  color: #475467;
}

.seg button.on {
  background: #ecfdf5;
  border-color: #0f9d6e;
  color: #067a52;
  font-weight: 600;
}

.seg.grid3 {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
}

.seg.small button {
  flex: none;
  padding: 6px 16px;
  font-size: 13px;
}

.dims {
  display: flex;
  align-items: flex-start;
  gap: 6px;
}

.dim {
  flex: 1;
  text-align: center;
}

.dim input {
  width: 100%;
  padding: 9px 6px;
  border: 1px solid #d0d5dd;
  border-radius: 9px;
  text-align: center;
  font-size: 16px;
  background: #fff;
}

.dim input:focus {
  outline: none;
  border-color: #0f9d6e;
}

.dim span {
  display: block;
  font-size: 12px;
  color: #98a2b3;
  margin-top: 3px;
}

.dim-x {
  color: #98a2b3;
  padding-top: 9px;
}

.chips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.chip {
  padding: 8px 16px;
  border-radius: 999px;
  background: #f2f4f7;
  border: 1px solid transparent;
  font-size: 14px;
  color: #475467;
}

.chip.on {
  background: #ecfdf5;
  border-color: #0f9d6e;
  color: #067a52;
  font-weight: 600;
}

.subfield {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
  flex-wrap: wrap;
}

.sublabel {
  font-size: 13px;
  color: #667085;
}

.mismatch {
  font-size: 12px;
  color: #b45309;
  background: #fffbeb;
  border-radius: 6px;
  padding: 3px 8px;
}

.qty {
  display: flex;
  gap: 8px;
  align-items: center;
}

.qty input {
  width: 90px;
  padding: 9px 6px;
  border: 1px solid #d0d5dd;
  border-radius: 9px;
  text-align: center;
  font-size: 16px;
}

.qty input:focus {
  outline: none;
  border-color: #0f9d6e;
}

.qty-btn {
  width: 40px;
  height: 40px;
  border-radius: 9px;
  background: #f2f4f7;
  font-size: 20px;
  color: #344054;
}

.result {
  border-top: 1px dashed #e4e7ec;
  margin-top: 4px;
  padding-top: 10px;
}

.result.error {
  color: #dc2626;
  font-size: 13px;
}

.fee {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 10px;
  padding: 3px 0;
  font-size: 13px;
}

.fee-left {
  display: flex;
  flex-direction: column;
}

.fee-name {
  color: #344054;
}

.fee-detail {
  font-size: 11px;
  color: #98a2b3;
}

.fee-amt {
  color: #344054;
  white-space: nowrap;
}

.fee-amt.light {
  color: #98a2b3;
}

.fee.subtotal {
  border-top: 1px solid #f2f4f7;
  margin-top: 4px;
  padding-top: 7px;
  font-weight: 600;
}

.badge {
  font-size: 12px;
  padding: 2px 10px;
  border-radius: 999px;
  background: #f2f4f7;
  color: #667085;
}

.badge.good {
  background: #ecfdf5;
  color: #067a52;
}

.badge.warn {
  background: #fffbeb;
  color: #b45309;
}

.item-total {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-top: 8px;
}

.item-total b {
  font-size: 22px;
  color: #067a52;
}

.add {
  width: 100%;
  padding: 13px 0;
  border-radius: 14px;
  border: 1px dashed #98a2b3;
  color: #475467;
  font-size: 15px;
  background: transparent;
  margin-bottom: 10px;
}

.bottombar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(10px);
  border-top: 1px solid #e4e7ec;
}

.bottombar .sum {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.sum-label {
  font-size: 12px;
  color: #667085;
}

.sum-amt {
  font-size: 22px;
  font-weight: 700;
  color: #067a52;
}

.copy {
  padding: 12px 26px;
  border-radius: 12px;
  background: #0f9d6e;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
}

.copy:disabled {
  background: #d0d5dd;
}

.toast {
  position: fixed;
  left: 50%;
  bottom: 110px;
  transform: translateX(-50%) translateY(8px);
  background: rgba(28, 36, 48, 0.92);
  color: #fff;
  font-size: 13px;
  padding: 9px 18px;
  border-radius: 999px;
  opacity: 0;
  pointer-events: none;
  transition: all 0.25s ease;
  white-space: nowrap;
}

.toast.show {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}
</style>
