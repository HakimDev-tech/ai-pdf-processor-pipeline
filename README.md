# AI PDF Processor Pipeline

> **Production-oriented AI document processing pipeline built with Next.js, n8n, Gemini/Groq, and Supabase.**

Automatically upload, process, summarize, and analyze PDF documents using Large Language Models (LLMs) through a modern AI automation architecture.

---

# 🚀 Overview

AI PDF Processor Pipeline is a full-stack AI application designed to automate the analysis of text-based PDF documents.

The project demonstrates how to build a production-style AI workflow using modern technologies without relying on vector databases or Retrieval-Augmented Generation (RAG).

Instead of functioning as a chatbot, the application processes each document independently, generates structured summaries and analyses, stores the results in PostgreSQL, and presents them through a modern web interface.

This project was built as a portfolio project to demonstrate practical skills in:

- AI Automation Engineering
- LLM Integration
- n8n Workflow Automation
- Next.js Full Stack Development
- Prompt Engineering
- Software Architecture

---

# ✨ Features

## Current MVP

- Upload PDF documents
- PDF validation
- Text extraction
- Text cleaning
- AI-powered structured summary
- AI-generated document analysis
- Automatic document categorization
- Keyword extraction
- PostgreSQL persistence
- User authentication
- Document history
- Error handling
- Responsive UI

---

# 🏗 Architecture

```text
                 User
                   │
                   ▼
          Next.js Frontend
                   │
                   ▼
         Next.js API Route
                   │
                   ▼
             n8n Webhook
                   │
                   ▼
          PDF Validation
                   │
                   ▼
          Text Extraction
                   │
                   ▼
            Text Cleaning
                   │
                   ▼
          Gemini / Groq API
                   │
                   ▼
      Structured JSON Response
                   │
                   ▼
          Supabase PostgreSQL
                   │
                   ▼
          Results & History
```

---

# ⚙ Tech Stack

## Frontend

- Next.js 15
- React
- TypeScript
- Tailwind CSS

## Backend

- n8n

## AI

- Google Gemini
- Groq

## Database

- PostgreSQL
- Supabase

## Authentication

- Supabase Auth

## Deployment

- Vercel
- n8n Cloud

---

# 📁 Project Structure

```text
ai-pdf-processor-pipeline/

├── frontend/
│
├── n8n/
│   ├── workflow.json
│   └── README.md
│
├── database/
│   ├── schema.sql
│   └── migrations/
│
├── prompts/
│   ├── system-prompt.md
│   └── user-prompt.md
│
├── docs/
│   ├── architecture.md
│   ├── database-schema.png
│   └── workflow.png
│
├── .env.example
│
└── README.md
```

---

# 🔄 Workflow

```text
Upload PDF
      │
      ▼
Validate PDF
      │
      ▼
Extract Text
      │
      ▼
Clean Text
      │
      ▼
Generate AI Analysis
      │
      ▼
Validate AI Output
      │
      ▼
Store Results
      │
      ▼
Return Response
```

---

# 🗄 Database

Main tables:

- profiles
- documents
- ai_results
- processing_logs
- notifications

Relationships:

```text
profiles
    │
    ├──────────────┐
    ▼              ▼
documents     notifications
    │
    ▼
ai_results
    │
    ▼
processing_logs
```

---

# 🤖 AI Processing

The LLM receives the extracted document text and produces:

- Structured summary
- Key points
- Keywords
- Category
- Document analysis
- Strengths
- Limitations
- Actionable recommendations

The output is returned as structured JSON before being stored in PostgreSQL.

---

# 📄 Supported Documents

Current MVP:

- Text-based PDF
- Maximum size: 20 MB
- One document per request

Not supported:

- OCR
- Image-only PDFs
- Password-protected PDFs
- Parallel processing

---

# 🛡 Error Handling

The pipeline handles:

- Invalid PDF
- Empty document
- Corrupted PDF
- Unsupported format
- AI timeout
- API quota exceeded
- Database errors
- Notification failures

Each execution generates processing logs for easier debugging.

---

# 📊 Future Roadmap

## Version 2

- OCR support
- Multiple document upload
- Better UI
- Dashboard
- Advanced filtering

## Version 3

- RAG
- Vector database
- Semantic search
- Multiple AI providers
- Team workspaces

---

# 🚀 Local Installation

## Clone repository

```bash
git clone https://github.com/your-username/ai-pdf-processor-pipeline.git
```

## Install dependencies

```bash
cd frontend
npm install
npm run dev
```

---

# 🔐 Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=

NEXT_PUBLIC_SUPABASE_ANON_KEY=

SUPABASE_SERVICE_ROLE_KEY=

N8N_WEBHOOK_URL=

GEMINI_API_KEY=

GROQ_API_KEY=
```

---

# 📦 Deployment

## Frontend

- Vercel

## Workflow

- n8n Cloud

## Database

- Supabase

---

# 🎯 Learning Objectives

This project demonstrates practical experience with:

- AI Automation Engineering
- Production AI Pipelines
- Prompt Engineering
- Workflow Automation
- LLM Integration
- Next.js Full Stack Development
- PostgreSQL Database Design
- Supabase
- REST APIs
- Software Architecture
- Error Handling
- Deployment

---

# 📸 Screenshots

The repository will include:

```text
/docs/screenshots/

Home Page

Upload Page

Processing

Results

Database

Workflow
```

---

# 📜 License

This project is released under the MIT License.

---

# 👨‍💻 Author

**Abdel Hakim Koumad**

Computer Science Engineering Student

**AI Builder → AI Automation Engineer → AI Agent Developer → AI SaaS Builder**

Focused on building production-ready AI applications using LLMs, workflow automation, and modern full-stack technologies.
