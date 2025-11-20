# MY-AI – Context-Aware Chatbot

A full-stack GenAI application for PDF analysis and intelligent conversation.

## Live Demo

[https://my-ai-q9gd.vercel.app/](https://my-ai-q9gd.vercel.app/)

## Tech Stack

### Frontend

* React
* Vite
* Tailwind CSS v4

### Backend

* Node.js
* Express.js

### Database

* MongoDB + Mongoose

### AI

* Google GenAI SDK (Gemini 2.5 / 1.5 / Pro fallback)

## Quick Setup

### Clone Repository

```bash
git clone https://github.com/anshmanitripathi/MY-AI-by-AMT
cd MY-AI-by-AMT
```

## Backend Setup

```bash
cd Backend
npm install
```

### Create `.env` file

```
PORT=5000
MONGO_URI=your_mongo_uri
GEMINI_API_KEY=your_api_key
```

### Start Server

```bash
node server.js
```

## Frontend Setup

```bash
cd ../Frontend
npm install
npm run dev
```
