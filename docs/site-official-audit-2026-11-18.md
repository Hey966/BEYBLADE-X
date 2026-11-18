# BEYBLADE X 全站與官方資料查核（2026-11-18）

## 介面與操作
- 依手機截圖，將「開始新對戰／暫停／下一回合／重設」移到即時競技盤正下方。雙方零件能力卡片在按鈕之後。
- 手機能力卡片改為單欄；操作鈕加大，避免為了操作反覆捲回即時畫面。
- 手機選單「對抗」改「克制」，與桌面「克制分析」一致。Spin Finish 的中文顯示改為「持久勝利」，原廠各 Finish 英文名稱保留中英對照。
- 原廠陀螺及零件的中英名稱、商品代碼、庫存，沒有改動。

## 官方規則已核對

| 項目 | 官方規則 | 網站處理 |
| --- | --- | --- |
| 四大類型 | Attack／Defense／Stamina／Balance，攻擊／防禦／持久／平衡 | 原有產品類型保持不變 |
| Spin／Survivor Finish | 持久終結 1 分 | 原得分正確；畫面用詞修正 |
| Over／Knockout Finish | 擊飛終結 2 分 | 原得分正確；事件加中英對照 |
| Burst Finish | 爆裂終結 2 分 | 原得分正確 |
| Xtreme Finish | 極限終結 3 分 | 原得分正確 |
| 勝負 | 先取得 4 分 | 原得分正確 |
| 3on3 | 三顆輪流上場；即使不同顏色，也不得重複使用同型號非例外零件 | 組裝、分析與模擬統一檢查 |
| CX Lock Chip | 一般型號可重複；Valkyrie／Emperor 各最多一個 | 加入特例檢查 |
| BEYBATTLEPASS | 官方可量測與記錄發射 SP | 網站自訂 0～14,000 改標「模擬發射強度」 |

官方來源：
- Hasbro 官方入門指南：https://beyblade.com/parent-guide/
- Takara Tomy 官方 3on3 賽規：https://beyblade.takaratomy.co.jp/beyblade-x/shop_event/manage/open_detail_all.html?id=57070
- Takara Tomy 官方賽事規定：https://beyblade.takaratomy.co.jp/beyblade-x/_image/regulation.pdf
- Takara Tomy 官方 BEYBATTLEPASS BX-09：https://beyblade.takaratomy.co.jp/beyblade-x/lineup/bx09.html
- Takara Tomy 官方說明書：https://beyblade.takaratomy.co.jp/beyblade-x/manual/

## 零件能力與重量

目前有 19 顆陀螺、9 組商品、78 筆能力紀錄。程式已檢查數值存在、0～100 分值範圍、固鎖高度與型號相符。**這不等於 78 筆能力都經官方實物盒裝查證。**

- 78 筆中有 4 筆經 Hasbro 包裝照片獨立核對修正：G3084-05 的完整戰刃與 Fort 主刃；G3084-06 的完整戰刃與 Wriggle 主刃。此四筆沿用既有修正值。
- 其餘 74 筆主要來自依發售版整理的第三方能力目錄。模擬器各零件明細現已新增可點擊的來源連結，但不能冒稱全部官方核驗。
- Mister Fantastic、Doctor Doom 兩片完整戰刃的參考重量缺資料。其餘重量包含第三方樣本與組件推算，不是使用者持有實物逐顆稱量。
- EVA-02 BXG-57-03 Brush 主刃仍有同版本衝突。發售目錄數字是攻擊 50、防禦 15、持久 10；另一參考為攻擊 40、防禦 25、持久 10。未有可靠包裝照片前不能選一組覆寫。
- Hasbro G3084 Wriggle Kraken S 為 3-85O。另一 Takara Tomy KrakenWriggle S 3-70O 是不同發售版本，不能混用。

目錄來源：
- https://beyblade.phstudy.org/data/hasbro.json
- https://beyblade.phstudy.org/data/main.json
- https://beybladewiki.com/toys/parts/x/main-blade

## 未經官方實測的模擬假設

0～14,000 的模擬發射強度、±35° 傾斜角、拉條與拉線的相對倍率、模型初轉速、碰撞、摩擦、盤緣高度、爆裂閾值、65 秒的模型時限、3D 幾何與批次模型勝率均屬遊戲化或理論近似。沒有找到官方發布的「14,000 為最高 SP」依據，也沒有官方可據以把模型數字換算為 SP、RPM 或牛頓拉力的校正表。

保留使用者既有輸入範圍，避免影響操作習慣；清楚移除把站內數字冒稱官方 SP 的表述。模擬結果不能作為實戰勝率。

## 自動檢查與局限

GitHub Actions 會檢查 JS 語法、78 筆能力數據完整性、已修正盒裝數字、3on3 同型號限制、CX 特例、分數與對戰模型、音效，以及手機按鈕與數值卡的顯示順序。

此為程式內部核對，**不能代替實機手機視覺驗收、對 78 筆逐件官方包裝交叉比對、精密秤重或實際戰鬥測試**。未經核實的數據依原有資料保留並標示限制。
