# 打样快速报价(A家)

复合袋打样报价工具,网页版(移动优先)。报价规则见 [规划.md](规划.md)。

**线上地址:https://leejunsc.github.io/dayang-baojia/**

改价或改界面后,运行 `bash scripts/deploy.sh` 一键重新发布(自动跑测试→构建→推送,约1分钟生效)。

## 目录结构

- `src/engine/rules.ts` — **所有价格规则配置**(单价、折扣档、低消、面积公式)。改价只动这个文件。
- `src/engine/quote.ts` — 报价引擎(纯 TS,框架无关,小程序可直接复用)
- `src/engine/quoteText.ts` — 生成发给客户的报价文本
- `src/engine/quote.test.ts` — 单元测试(39 条,覆盖全部规则与边界)
- `src/App.vue` — 网页界面

## 常用命令

```bash
npm run dev    # 本地开发
npm test       # 跑单元测试(改规则后务必跑一遍)
npm run build  # 打包,产物在 dist/,可部署到任意静态托管
```

## 改价指南

打开 `src/engine/rules.ts`,对应修改后跑 `npm test`:

- 印刷单价/低消:`printing`
- 制袋费:`bagMaking`
- 开窗费:`window`
- 表面不一致加价:`surfaceMismatch`
- 嘴/气阀(单价与最低计费数量):`spout` / `valve`
- 折扣档:`discountTiers`
- 特小袋阈值:`tinyBag`
- 报价文案:`quoteFooter`
- 面积公式:`spreadAreaCm2` 函数
