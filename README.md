# Halftone Generator (Web)

使用瀏覽器本地運行的半色調轉換工具。提供 Floyd-Steinberg Dithering 與簡單閾值模式，並可調整對比度、點尺寸與閾值。支持多圖批次處理及 ZIP 打包下載。

## ✨ 特點
- 100% 本地運行：不會上傳任何圖片或資料到伺服器。
- 支援格式：JPG / JPEG / PNG / GIF / WEBP / BMP / TIFF。
- 演算法：Floyd-Steinberg Dithering + 可視化放大網點。
- 多圖批次處理：完成後可分別下載或全部 ZIP。
- 右鍵選取圖片 -> 可單獨批次下載。
- 離線友好：無外部 CDN。未來將加入 PWA 完整離線重載。

## 🕹 使用步驟
1. 上傳或拖拽多張圖片。
2. 調整參數：對比度 / 閾值 / 點尺寸 / 模式。
3. 按「開始轉換」。
4. 預覽結果，右鍵選取需要的圖片。
5. 按「下載選取」或「全部 ZIP」。

## ⚙ 參數說明
| 參數 | 說明 |
|------|------|
| 對比度 | 拉高可增強細節，過高可能失真。 |
| 閾值 | 決定黑白分界，低值偏黑，高值偏白。 |
| 點尺寸 | 放大視覺網點，不改變運算內部解析度。 |
| 模式 | Floyd-Steinberg：擴散誤差；單純閾值：硬分割。 |
| 強制白背景 | 預留功能（未來加清理雜點）。 |

## 🧱 專案結構
```
index.html
src/
  main.ts                # UI & 狀態
  style.css              # 介面樣式
  types.ts               # 型別定義
  algorithms/floydSteinberg.ts  # 演算法
  worker/halftoneWorker.ts       # Web Worker 處理
  utils/image.ts         # 載入/轉換工具
  download.ts            # 單檔 / ZIP 下載介面
  zip.ts                 # fflate 封裝
```

## 📦 安裝與開發
```bash
npm install
npm run dev
```
開啟瀏覽器 http://localhost:5173

建置：
```bash
npm run build
```
輸出至 `dist/` 可部署到 GitHub Pages。

## 🔒 隱私與資料
所有處理均在瀏覽器記憶體完成：
- 不使用網路 API、不傳送圖片至任何第三方。
- 可在首次載入後斷網繼續操作（重新載入需網路，未來 PWA 改善）。

## 🚀 未來 Roadmap
- PWA Service Worker 完整離線。
- 真實圓點角度網格半色調 (CMYK 風格)。
- WebAssembly 加速 (Rust)。
- 桌面版 (Tauri/Electron)。
- 背景自動清理 / 去雜點形態學。

## 🙏 致謝
靈感與半色調擴散誤差演算法源自經典影像處理技術。MIT License。

## 📄 License
MIT
