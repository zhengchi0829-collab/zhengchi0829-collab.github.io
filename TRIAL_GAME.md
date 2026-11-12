# 沙海戰神Ⅰ・黃金神殿Ⅱ

兩款由本站獨立製作的瀏覽器遊戲，使用原創程式、SVG 圖示與生成的埃及主題場景。以虛擬點數運作，沒有儲值、金錢交易、提領、兌換或獎品。沒有載入第三方遊戲，不宣稱任何外部供應商出品或原廠機率。

## 使用方式與進度

在本網站「免費試玩」區域選擇遊戲，直接於同頁開始。所有遊戲程式與圖像均由本專案的 GitHub Pages 提供，試玩不開外部頁面，不需要 API key、會員帳號、後端或資料庫。

兩款遊戲分別從 10,000 點起始，各自保留本頁內的點數、每回合設定、免費回合與倍率鎖定。切換遊戲或關閉再開不清除進度；重設只影響目前遊戲，重新整理整頁則兩款都重設。最近三局紀錄涵蓋兩款遊戲；重設時移除該遊戲的紀錄。

## 共通規則

- 六欄五列，任意位置累積八個以上同種普通符號即可計分並消除，上方符號依欄掉落補位。
- 每局使用點數可選 20、50、100、200、500。每局最多結算六次連消；第六次後補位若仍有組合，不再計分。
- 符號基礎得分＝每回合點數 × 符號基礎倍數 × 數量級距，四捨五入成整數。數量八至九個為 1 倍、十至十一個為 2 倍、十二個以上為 3.5 倍。
- 每一步連消的得分依該步有效倍率計算，再累加本局結果；不同符號得分分別計算。
- 使用點數的初始盤面出現四個以上神印，送五次免費回合。補位盤面不觸發，免費回合也不會再觸發。
- 免費回合不扣點，沿用獲得免費回合時的點數設定，完成之前不能調整。
- 可以使用當前每回合點數的 100 倍，換取五次免費回合。按下按鈕先顯示站內確認卡，確認後才扣除虛擬點數。已有免費回合或正在轉動時不能再次購買。
- 遊戲使用瀏覽器 Web Crypto 產生隨機值，不可用時退回 Math.random。這些都是本站設定的娛樂規則，沒有承諾經認證的 RTP 或公平性，也不能用來預測其他遊戲。

### 沙海戰神Ⅰ

每局獨立抽出 1／2／3／5 倍，權重分別為 65／20／10／5，該倍率套用於本局各次連消。

### 黃金神殿Ⅱ

未鎖定時同樣從 1／2／3／5 倍開始。每次有得分的連消，各有 20% 機會把倍率翻倍，上限 20 倍；翻倍先發生，再支付該次連消，已完成的前一步不追溯提高。

如果本局開始時沒有鎖定且本局有得分，結算後有 15% 機會將最終倍率鎖定給接下來兩局。鎖定期間每一次轉動都消耗一局，包含免費回合或沒有得分的回合。當局分裂不修改下一局預留的鎖定倍率，使用既有鎖定時不再抽取新鎖定。購買免費回合本身不消耗鎖定或增加已玩局數。

例：第一步基本得分 105、有效倍率 2，得到 210；第二步基本得分 140、倍率分裂為 4，得到 560。本局得分為 770，而非把全部基本得分乘最後倍率。

## 維護檔案

| 檔案 | 用途 |
| --- | --- |
| `seth-game-engine.js` | 純函式引擎、倍率分裂／鎖定、免費回合、虛擬點數結算 |
| `seth-trial.js` | 自訂元件、原創 SVG、動畫、音效、購買確認、兩款進度及最近紀錄 |
| `seth-trial.css` | 卡片主視覺、桌機雙欄與手機單欄、滿版、降低動態效果 |
| `assets/sand-warrior.webp` | 沙海戰神Ⅰ原創場景 |
| `assets/golden-temple.webp` | 黃金神殿Ⅱ原創場景 |
| `index.html` | 模組、樣式版本與無 JavaScript 說明 |
| `script.js` | 原站編譯後 React；保留免費試玩導覽與元件掛載 |

所有樣式限制在試玩元件內。保留 `<seth-trial id="seth-trial">` 掛載位置與原站的 100px scroll-padding；元件 scroll-margin 為 0，避免重複偏移。

## 引擎與動畫契約

`resolveSpin` 先一次提交整局最終狀態，再交由 UI 播放。關閉、頁面隱藏或卸載時取消動畫並顯示完整結算，不發生半次扣點。每一結果只寫入一次最近紀錄。

`frames[].win` 是倍率前得分，`frames[].payout` 是該步真正實付。`result.totalWin` 必須是各步 payout 加總；不能改為 baseWin 乘最終 multiplier。分裂事件用 `splitBoolean`，鎖定事件用 `lockAwarded`，結算後剩餘局數看 `state.lockedRounds`。

購買前固定當下遊戲與每回合點數，確認期間鎖住其他會修改它們的控制；確認只能成功一次。全螢幕不可用時使用同頁滿版，關閉時恢復頁面滾動與焦點。

## 驗證

執行 `node --test tests/engine.test.mjs` 可重跑 21 項確定性引擎測試，涵蓋逐步分裂支付、20 倍上限、鎖定消耗、免費回合與虛擬點數購買、資金不足、純函式不修改輸入及隨機來源 fallback。

## 圖像製作

兩張背景以內建 image_gen 生成，沒有提供或使用第三方遊戲參考圖片。生成後以同尺寸轉為 WebP，供網站載入；原始構圖未經裁切或更改。畫面元素為原創鷹首守衛、沙漠神殿及紫金神殿守護者，無外部遊戲商標。

以下保留完整生成提示詞，方便日後製作同一視覺方向的新素材。

### 沙海戰神Ⅰ

Use case: stylized-concept. Asset type: original browser fantasy game poster/background, wide landscape 3:2. Create a highly polished richly painted 3D fantasy Egyptian desert artwork, not an interface. An original imposing falcon-headed guardian warrior with burnished golden armor, dark midnight blue cloth, geometric sun-ring crown, glowing amber eyes, and ornate crescent-edged polearm stands on the RIGHT 55 percent of frame. His costume is a new original design with intricate layered feathers and polished lapis stones, no resemblance to any existing video-game character. In the left 45 percent are ancient sandstone pylons, pyramids and dark desert dunes at sunset, with an eclipse halo and scattered gold dust. Composition is cinematic waist-up portrait occupying right side, guardian face safely inside top center-right, left lower region deliberately quieter and darker for website title overlay. Strong polished gold highlights, cobalt shadows, amber sun shafts, deep atmospheric contrast. Premium fantasy game concept art, tactile brushed metal and carved stone, lush painted detail. No text, no letters, no numbers, no game UI, no reels, no logos, no trademarks, no watermark.

### 黃金神殿Ⅱ

Use case: stylized-concept. Asset type: original browser fantasy game poster/background, wide landscape 3:2. A luxurious enchanted Egyptian golden temple at night in an original high-end painted 3D fantasy style. On the RIGHT 55 percent stands an original regal female temple guardian wearing layered gold and amethyst ceremonial armor, elaborate wing-shaped jeweled crown, shoulder-length silver-black hair, luminous violet eyes, holding a hovering faceted amethyst crystal between two golden crescent rings. The guardian is dignified, fully clothed, a new original character with no resemblance to existing video-game characters. Behind her are immense gilded lotus columns and a glowing violet celestial aperture; LEFT 45 percent shows dark indigo temple corridors with suspended golden geometric charms and subtle purple magical dust, quiet darker lower-left space for website title overlay. Cinematic waist-up composition, face safely inside top center-right, premium luminous violet and antique gold, glossy gems and brushed gold, vivid but controlled contrast, detailed fantasy game concept painting. No text, no letters, no numbers, no game UI, no reels, no logos, no trademarks, no watermark.

