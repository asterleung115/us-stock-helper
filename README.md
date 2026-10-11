# 美股入門助手

用簡單廣東話／繁體中文，教完全冇投資經驗嘅人睇圖、查股票、分析美股。React + Vite + Tailwind CSS，純前端，唔使後端。

> 只供學習用途，唔係投資建議。過去表現唔代表將來。

## 功能

| 頁面 | 內容 |
| --- | --- |
| 教學 | 7 課睇圖教學：K 線、成交量、移動平均線、支持阻力、RSI、MACD、趨勢線。每課一步一步解釋，配互動圖表，最後有「試下睇」練習（可以無限換題），進度會記低。 |
| 搜尋股票 | 輸入代號（例如 AAPL、TSLA、NVDA），睇現價、公司簡介、走勢圖（K 線 + 50／200 日線 + 成交量）、市值、市盈率、EPS、收入增長、股息等。可以收藏股票。 |
| 分析 | 技術分析（趨勢、趨勢線、RSI、MACD、支持阻力、波幅、最大跌幅、相對大市）+ 基本分析（估值、增長、賺錢能力、負債），每個數字都有白話解釋，最後俾出「相對值得考慮／中性／風險較高」同理由。評分規則喺頁面底公開。 |
| 潛力觀察 | 每晚由標普 500 按四套公開條件篩出觀察名單：分析員目標價、升勢未過熱、高增長又賺錢、賺錢公司回落中。另有全部篩選數據表。只係篩選結果，唔係推薦。 |
| 比較 | 2–3 隻股票同一起點當 100 比較表現，再並排比較主要數據。 |
| 學習路徑 | 點樣開始投資美股（可剔完成）、風險管理、常見錯誤、35 個詞彙（可搜尋）。 |
| 工具 | 倉位／風險計算機（由止蝕位反推買幾多股）、定投複利計算機。 |
| 設定 | API key、深色／淺色模式、清除本機資料。 |

## 開始

需要 Node.js 18 或以上。

```bash
npm install
npm run dev        # 開發模式，打開 http://localhost:5173
npm run build      # 輸出到 dist/，可以放上任何靜態網站寄存（Netlify、GitHub Pages 等）
npm run preview    # 預覽 build 好嘅版本
```

## 數據來源

### 每晚自動更新（GitHub Actions）

`.github/workflows/update-and-deploy.yml` 會喺每個美股交易日收市後（UTC 22:30）、每次 push 去 main、或者喺 Actions 頁手動撳「Run workflow」時：

1. `scripts/update_screener.py`：篩選標普 500 成份股（名單由 Wikipedia 攞），計回報、均線、RSI、波幅，再攞市盈率、收入增長、利潤率、分析員目標價同評級，按四套公開條件揀出「潛力觀察」名單 → `public/data/screener.json`。呢步失敗唔會阻止發佈。
2. `scripts/update_data.py`：為 `scripts/tickers.json` 入面嘅股票，加埋潛力觀察名單入面嘅股票，攞：
   - 近 5 年每日股價 → `public/data/prices/<T>.json`
   - 公司資料、財務數字、下次業績日期、交易所 → `public/data/fundamentals/<T>.json`
   - ETF：管理費、基金規模、十大持股
3. Build 網站，發佈去 GitHub Pages。

數據**唔會** commit 返入 repo（免得 repo 越嚟越大）；repo 入面嘅 `public/data` 只係俾本機開發用嘅舊快照。

想加減股票：改 `scripts/tickers.json`（用 Yahoo 格式，例如 `BRK-B`），push 上去就會自動重新發佈。中文簡介喺 `src/content/companies.js`，冇寫都照樣用到。

**第一次設定**（只做一次）：GitHub repo → Settings → Pages → Source 揀「GitHub Actions」。

喺自己電腦手動更新：

```bash
pip install -r scripts/requirements.txt
python scripts/update_data.py
```

### 瀏覽器入面嘅來源次序

| 數據 | 來源 | 唔得嘅時候 |
| --- | --- | --- |
| 股價 K 線 | 每晚快照（`public/data/prices/`） | 有 Alpha Vantage key：任何股票最近 100 日 → 否則用示範走勢（畫面會清楚標明） |
| 即時報價 | Finnhub `/quote`（要 key）；另外股票頁有 TradingView 報價小工具（唔使 key） | 用最後收市價 |
| 財務數據 | Finnhub（要 key）→ 每晚快照 → Alpha Vantage（要 key） | 顯示「未有數據」，用戶可以撳掣睇示範畫面 |

- 唔加任何 key 都用得：清單入面嘅股票全部有真實股價同財務數據（每晚更新）。key 只係用嚟睇清單以外嘅股票或者即時報價。
- **點解瀏覽器唔直接讀 Yahoo？** Yahoo 唔俾瀏覽器直接讀（冇 CORS），所以改為由 GitHub Actions 喺伺服器攞，再存成靜態檔案。
- `npm run update-data` 係舊方法：由 [yennanliu/finance_data](https://github.com/yennanliu/finance_data) 下載 33 隻股票嘅股價（冇財務數據），喺攞唔到 Yahoo 嘅環境先用。

### API key（可選、免費）

1. Finnhub：<https://finnhub.io/register>（每分鐘 60 次）
2. Alpha Vantage：<https://www.alphavantage.co/support/#api-key>（每日 25 次）

喺 App 嘅「設定」頁貼上（儲存喺瀏覽器 localStorage），或者複製 `.env.example` 做 `.env`。注意 `VITE_` 開頭嘅變數會被打包入前端程式碼，公開網站唔好咁做。

## 項目結構

```
src/
  App.jsx                 導覽同頁面切換（網址 # 記住頁面）
  pages/                  教學、搜尋、分析、比較、學習路徑、工具、設定
  components/
    Charts.jsx            lightweight-charts 圖表：K 線、均線、成交量、支持阻力、趨勢線、RSI、MACD、比較
    StockHeader.jsx       股票名稱、現價、收藏、數據來源
    ui.jsx                卡片、按鈕、載入中、錯誤、空白狀態、免責聲明等
    theme.jsx             深色模式
  lib/
    api.js                資料層（快照 → Finnhub → Alpha Vantage → 示範），10 分鐘快取
    indicators.js         SMA、EMA、RSI、MACD、波幅、最大跌幅、支持阻力、趨勢線、Beta
    analysis.js           將指標同財務數字變成白話解釋、評分同結論
    mock.js               示範數據同教學情境走勢
    storage.js            localStorage（收藏、進度、key）
  content/
    lessons.js            睇圖教學內容同練習題
    path.js               學習路徑、風險管理、常見錯誤、詞彙表
    companies.js          內置股票中文簡介
scripts/update_data.py    每晚更新股價同財務數據（GitHub Actions 用）
scripts/tickers.json      要追蹤嘅股票清單
scripts/fetch-prices.mjs  舊方法：由 yennanliu/finance_data 下載股價
.github/workflows/        每晚更新數據並發佈去 GitHub Pages
public/data/              股價快照 JSON
```

## 評分規則（簡化版）

- 技術面 100 分：趨勢 40（股價同 50／200 日線）、動能 30（RSI 健康範圍、MACD 方向）、風險 30（年化波幅越低越高分）。
- 基本面 100 分：估值 30（市盈率）、增長 25（收入增長）、賺錢能力 25（淨利潤率）、財務穩健 20（負債／股東權益）。
- 有真實財務數據時，綜合分數 = 兩者平均；冇就只計技術面。ETF 加 5 分。
- 65 分或以上 →「相對值得考慮」；45 分以下，或者年化波幅 > 65%、3 年內曾跌超過 60%、公司蝕緊錢 →「風險較高」；其餘 →「中性」。

規則喺 `src/lib/analysis.js`，刻意寫得簡單，方便新手理解同自己改。

## 其他

- `npm run build:single` 會輸出一個塞晒 JS／CSS 嘅 `dist-single/index.html`（股價快照仍然係 `data/` 入面嘅 JSON），方便單檔分享。
- 圖表用 [TradingView Lightweight Charts](https://github.com/tradingview/lightweight-charts)（Apache-2.0，圖表角落會顯示 TradingView 標誌）。
