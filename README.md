# Shelfwise - Book Search Website

Search any book in any language. Browse trending books, new releases and categories. Data comes live from the free Open Library API, which needs **no API key and no sign-up**.

**Stack:** HTML, CSS, Tailwind CSS (CDN), JavaScript, Node.js + Express

## Run it
1. Install Node.js 18 or newer.
2. In this folder run:
   ```
   npm install
   npm start
   ```
3. Open http://localhost:3000

## Features
- Search by anything, or only by title, author or subject
- Language filter (English, Urdu, Hindi, Punjabi, Arabic and more) and sort by relevance, newest or top rated
- Trending (weekly / daily / monthly), recently published, and 10 category shelves
- Book details popup with description, subjects, rating and a link to read or borrow on Open Library

## Files
- `server.js` - Express server that calls Open Library and caches answers for 10 minutes
- `public/index.html`, `public/style.css`, `public/app.js` - the website

Book data and covers are provided by Open Library (openlibrary.org).
