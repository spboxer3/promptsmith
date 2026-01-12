<p align="center"><img src="assets/icons/icon128.png"></p>

<h1 align="center">PromptSmith - AI 驅動的最佳化客戶端 (BYOK)</h1>

<p align="center"><a href="README.md">English</a> | 繁體中文</p>

PromptSmith 是一款注重隱私、「自帶金鑰 (Bring Your Own Key, BYOK)」的 Chrome 擴充功能。它讓您可以直接在瀏覽器中，使用您偏好的 AI 模型（OpenAI、Anthropic、Gemini 或本地端模型）來優化文字、修正語法和微調提示詞 (Prompt)，適用於任何網頁。

## 核心特色

- **自帶金鑰 (BYOK)：** 支援連接您自己的 OpenAI、Anthropic 或 Google Gemini API 金鑰。完全掌控您的使用量與成本。
- **支援本地端 AI：** 可無縫連接至本地運行的 LLM（例如透過 LM Studio, Ollama, LocalAI），確保絕對隱私與離線功能。
- **全網通用：** 適用於任何網站。選取文字，喚醒 PromptSmith，立即優化。
- **自訂策略 (Strategies)：** 針對特定任務建立專屬提示詞策略，例如「修正語法」、「專業語氣」、「摘要重點」或「程式碼審閱」。
- **隱私均先：** 您的 API 金鑰與設定皆儲存於您的瀏覽器本地端，不經過任何第三方中介伺服器。
- **智慧介面：** 極簡的懸浮審閱視窗、差異 (Diff) 比對檢視，並支援鍵盤快捷鍵 (`Alt+P`) 快速啟動。

## 安裝指南

1.  複製此專案代碼或下載原始碼壓縮檔。
2.  開啟 Chrome 瀏覽器並前往 `chrome://extensions`。
3.  開啟右上角的 **開發人員模式 (Developer mode)**。
4.  點擊 **載入未封裝項目 (Load unpacked)**。
5.  選擇包含此擴充功能檔案的目錄。

## 使用說明

1.  **設定 (Configuration)：**

    - 點擊擴充功能圖示或進入 **設定 (Options)** 頁面。
    - 前往 **連線端點 (Endpoints)** 新增您的 AI 服務商資訊 (API Key, 模型名稱)。
    - (選用) 設定 **優化策略 (Strategies)** 來客製化 AI 處理文字的方式。

2.  **優化文字：**
    - 在網頁上選取任意文字。
    - 按下觸發快捷鍵 (預設為 `Alt+P`)，或點擊懸浮的 "PromptSmith" 按鈕 (若已啟用)。
    - 從選單中選擇一個策略。
    - 在差異檢視視窗中審閱 AI 的建議。
    - 點擊 **套用變更 (Apply)** 直接替換原始文字，或點擊 **複製 (Copy)** 將結果存入剪貼簿。

## 授權條款

[在此加入授權資訊，例如 MIT]


