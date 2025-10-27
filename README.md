# 📰 Smart News Summarizer (Chrome Extension)

A lightweight **Chrome Extension** that automatically detects when you're reading a news article and instantly summarizes it using a **custom TextRank algorithm** — no pretrained models, no API calls, and completely offline.

It’s fast, private, and beautifully designed with a local bookmarking system, tags, and dark/light themes.

---

## ✨ Features

- 🧠 **Extractive Summarization** using **TextRank**, implemented entirely from scratch.  
- 🌐 **Auto-Detects News & Article Websites** — works only on real news pages.  
- ⚡ **Fully Offline & Private** — no internet or external API calls required.  
- 📚 **Smart Bookmark System**  
  - Save and tag summarized articles.  
  - Search, sort, and filter bookmarks.  
  - Stored locally using `chrome.storage.local`.  
- 🌓 **Dark / Light Theme Toggle** with persistent preference.  
- 📏 **Responsive Snap Sizes** — Small, Medium, and Large popup layouts.  
- 🧩 **Dynamic Sentence Counter** — adjusts summary length seamlessly.  
- 📜 **Scrollable Summary Box** — no text clipping even in small popups.  

---

## 🧩 Tech Stack

| Layer | Technology |
|-------|-------------|
| **Frontend** | HTML, CSS, Vanilla JavaScript |
| **Summarizer** | Custom TextRank implementation (no pretrained model) |
| **Browser API** | Chrome Extensions API (`chrome.tabs`, `chrome.storage`) |
| **Storage** | Local browser storage (privacy-friendly) |
| **Dependencies** | None — runs 100% locally in the browser |

---

## 🛠️ Installation (Developer Setup)

1. **Clone this repository**
   ```bash
   git clone https://github.com/yourusername/news-summarizer-extension.git
   cd news-summarizer-extension
Open Chrome Extensions page

arduino
Copy code
chrome://extensions/
Enable Developer Mode (toggle at top right).

Click “Load unpacked” and select your project folder.

✅ The extension will now appear in your Chrome toolbar!

🚀 How to Use
Visit any news article (BBC, CNN, NDTV, The Guardian, etc.).

Click the extension icon in the Chrome toolbar.

The extension will:

Detect the article automatically.

Generate a summary using the TextRank algorithm.

Adjust the number of sentences dynamically — updates instantly.

Click Save to bookmark the article with optional tags.

Access all your saved bookmarks from the dropdown panel.

🧱 Folder Structure
bash
Copy code
📦 news-summarizer-extension
 ┣ 📜 manifest.json          # Extension manifest (permissions, scripts)
 ┣ 📜 popup.html             # Popup UI layout
 ┣ 📜 popup.js               # Core popup logic and UI handling
 ┣ 📜 textrank.js            # TextRank summarization algorithm
 ┣ 📜 content_script.js      # Extracts readable article text
 ┣ 📜 background.js          # Detects news pages and triggers popup
 ┗ 📜 README.md
📸 Screenshots
(Add your screenshots below — recommended width: ~800px)

🔹 Popup Interface
🔹 Dark Mode
🔹 Bookmark Manager
🔒 Privacy
This extension is 100% local — no server calls, no tracking, and no analytics.
All summaries, bookmarks, and preferences are stored safely in your browser.

🧠 Algorithm (TextRank Overview)
TextRank is a graph-based algorithm for extractive summarization.

Steps:

Split the text into sentences.

Compute similarity between sentences (shared keywords / TF-IDF).

Build a graph with sentences as nodes and similarity as edges.

Run PageRank to score importance of each sentence.

Select top-ranked sentences to form the final summary.

This project implements TextRank entirely in JavaScript, optimized for speed and small input text (news articles).

🧭 Roadmap
🏷️ Auto-tag generation from article keywords.

🔁 Cloud sync using Chrome Sync Storage.

🔊 Text-to-Speech summaries.

🦊 Firefox & Edge support.

💾 Export bookmarks as JSON or Markdown.
