# Product Requirements Document (PRD)

This PRD is designed to give clear alignment for developers who will implement the project.

## 1. Project Overview

We are building a web application that showcases Cerebras' fast inference capabilities. The core idea is to let users:

1. Upload a PDF file
2. Prompt the model about the file's contents
3. Receive real-time answers or clarifications from the model

This application serves as a demo of both the front-end UX (Next.js + Tailwind) and the server-side (FastAPI + pdfplumber + Cerebras inference).

## 2. Goals and Objectives

* **Demonstrate Cerebras Fast Inference:** Provide near real-time responses to user queries about a PDF file's text
* **Simplicity & Usability:** Make it easy for anyone to sign up, upload a PDF, and start interacting with the model
* **Persistence:**
  * Save user sessions (chats)
  * Allow users to revisit past conversations with the model

## 3. Core Functions

### 3.1 User Authentication
* Users can create an account and log in via NextAuth
* Authentication session management (token or session-based)

### 3.2 PDF Upload & Parsing
* Users can upload a PDF file
* Use pdfplumber (in the FastAPI server) to parse and extract text
* Prepare text data to be fed to the Cerebras model for inference
### 3.3 Prompt the Model
* Once a PDF is uploaded, the user can pose queries
* The system responds based on the PDF's content
* Show real-time or near real-time responses

### 3.4 Chat Sessions
* Users can create a new chat session
* Old chat sessions are saved so the user can revisit them
* Chat session data includes user messages and corresponding model responses

## 4. Technical Requirements

### 4.1 Front-End Stack
* Next.js 15 (using the new App Router)
* React (bundled with Next.js)
* Tailwind CSS for styling
* shadcn for a prebuilt UI component library that integrates well with Tailwind

### 4.2 Authentication
* NextAuth for login, logout, session handling, etc.
* Minimal or in-memory storage for sessions initially (could be upgraded later)

### 4.3 Back-End (Python)
* FastAPI for RESTful endpoints
* pdfplumber for PDF parsing
* Some mechanism for calling Cerebras model APIs or local inference

### 4.4 Data Storage
* Potential in-memory or simple DB (SQLite/Postgres) to store:
  * User information
  * Chat sessions/messages
  * Metadata about uploaded PDFs (e.g., file name, processed text)

### 4.5 HTTP Requests
* Fetch or Axios in Next.js for making calls to the FastAPI service

## 5. High-Level Flow

### 5.1 User Registration/Login
* The user visits the login page, enters credentials
* NextAuth handles authentication flow
* On success, user is redirected to the "dashboard" or "upload" page

### 5.2 Upload PDF
* The user selects or drags a PDF file into the uploader
* A request is sent to the FastAPI endpoint
* The server uses pdfplumber to parse the PDF's text
* (Optional) The parsed text or embeddings are stored for subsequent retrieval

### 5.3 Chat / Prompt
* The user navigates to the chat interface
* The user's queries are sent to the FastAPI endpoint referencing the PDF's content
* The Cerebras inference endpoint returns a response
* Each query-response pair is saved to the user's chat session

### 5.4 Session Management
* The user can see a list of previous chat sessions
* Selecting a session loads the conversation's messages and responses

## 6. File/Directory Structure

Below is a suggested minimal file structure. The aim is to have as few files as possible while still maintaining clarity:

```
cere-inference-demo/
├── README.md                // Project overview and setup instructions
├── next.config.ts           // Next.js config (TypeScript)
├── package.json             // Node dependencies & scripts
├── tsconfig.json           // TypeScript config
├── postcss.config.mjs      // PostCSS config for Tailwind
├── tailwind.config.ts      // Tailwind config
├── .env                    // Environment variables (ignored in git)

├── app/                    // Next.js 15 (App Router) directory
│   ├── layout.tsx         // Global layout (header, nav, etc.)
│   ├── globals.css        // Global styles (Tailwind imports)
│   │
│   ├── login/
│   │   └── page.tsx       // Login page
│   │
│   ├── upload/
│   │   └── page.tsx       // PDF file upload page
│   │
│   ├── chat/
│   │   └── page.tsx       // Chat interface (lists old sessions, create new)
│   │
│   └── api/
│       └── auth/
│           └── [...nextauth].ts  // NextAuth route handler

├── components/            // Reusable UI components
│   ├── chat-window.tsx    // Renders messages, input box, etc.
│   └── pdf-uploader.tsx   // Reusable PDF uploader component

├── lib/
│   └── auth-utils.ts      // Reusable NextAuth config or helper functions

├── server/               // FastAPI server (Python)
│   ├── main.py           // Entrypoint for FastAPI
│   └── requirements.txt   // Dependencies (FastAPI, pdfplumber, etc.)

└── instructions.md       // Additional notes/instructions
```

**Key Notes:**
* `app/`: Houses Next.js App Router pages
* `components/`: All shared UI modules (chat window, PDF uploader, etc.)
* `lib/`: Shared logic that isn't UI-specific (e.g., NextAuth config)
* `server/`: Contains the Python FastAPI code for PDF parsing and Cerebras inference

## 7. Endpoints & Documentation

### 7.1 FastAPI Endpoints

#### POST /upload_pdf
* **Request:** PDF file (multipart/form-data)
* **Process:** Uses pdfplumber to extract text
* **Response:**
```json
{
  "pdf_id": "1234",
  "message": "PDF successfully uploaded and parsed."
}
```

#### POST /chat
* **Request:**
```json
{
  "pdf_id": "1234",
  "user_query": "What is the main topic of this document?"
}
```

* **Process:**
  * Retrieves the PDF text from storage/cache
  * Sends prompt + context to the Cerebras inference model
  * Receives a text response
* **Response:**
```json
{
  "response": "The document primarily discusses AI trends in 2023..."
}
```

### 7.2 Next.js (App Router) Endpoints
* **POST /api/auth/[...nextauth]**
  * NextAuth route for sign-in, callbacks, etc.
  * Stores session tokens/cookies
  * (Optional) Could have a Next.js route proxy for file uploads if you prefer to route everything via Next.js instead of calling the FastAPI directly from the client

## 8. Example Code & Model Responses

Below are illustrative snippets to guide developers. Do not treat them as production code—they are purely for showing the flow and expected data.

### 8.1 PDF Parsing (FastAPI + pdfplumber)

```python
# server/main.py (Example snippet)

from fastapi import FastAPI, File, UploadFile
import pdfplumber

app = FastAPI()

@app.post("/upload_pdf")
async def upload_pdf(file: UploadFile = File(...)):
    try:
        # Read file bytes
        pdf_bytes = await file.read()

        # Use pdfplumber to extract text
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            all_text = ""
            for page in pdf.pages:
                all_text += page.extract_text() + "\n"

        # TODO: Store 'all_text' in memory or DB
        return {"pdf_id": "1234", "message": "PDF successfully uploaded and parsed."}
    except Exception as e:
        return {"error": str(e)}
```

### 8.2 Cerebras Inference (Pseudo-code)

```python
# Continuing in main.py (pseudo-code)
@app.post("/chat")
async def chat_with_model(pdf_id: str, user_query: str):
    # 1. Fetch stored text for pdf_id
    doc_text = "...some previously stored text..."

    # 2. Construct prompt with doc_text + user_query
    prompt = f"Document: {doc_text}\nQuestion: {user_query}\nAnswer:"

    # 3. Send prompt to Cerebras model
    # response = cerebras_inference_api(prompt)
    
    # 4. Return the model's response
    return {"response": "Here is the summarized answer..."}
```

### 8.3 Next.js Client-Side Call to FastAPI (React Example)

```typescript
// components/chat-window.tsx (Example usage, not actual production code)
import React, { useState } from 'react';

function ChatWindow() {
  const [userQuery, setUserQuery] = useState('');
  const [modelResponse, setModelResponse] = useState('');

  async function handleAskQuestion() {
    // Example call to the FastAPI endpoint
    const res = await fetch('http://localhost:8000/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pdf_id: "1234",
        user_query: userQuery
      })
    });
    const data = await res.json();
    setModelResponse(data.response);
  }

  return (
    <div>
      <textarea value={userQuery} onChange={(e) => setUserQuery(e.target.value)} />
      <button onClick={handleAskQuestion}>Ask</button>
      <p>Model Response: {modelResponse}</p>
    </div>
  );
}

export default ChatWindow;
```

### 8.4 Example User/Model Interaction
* **User:** "Please summarize the first three paragraphs of the PDF."
* **Model:** "The first three paragraphs focus on the impact of AI in healthcare, detailing how advanced machine learning techniques..."

## 9. User Flows

### 9.1 Sign Up / Login
* User visits the /login page → enters credentials → NextAuth verifies → user is redirected to /upload

### 9.2 Uploading a PDF
* On the /upload page, user drags or selects a PDF → system sends file to /upload_pdf → on success, store pdf_id

### 9.3 Chatting with the Model
* User navigates to /chat page
* If no existing session, a new session is created with a session_id
* User types a query → sends it to /chat (with the pdf_id and user query)
* Server returns a response
* Chat window displays the response and appends it to the session history

### 9.4 Revisiting Old Sessions
* User sees a list of previous sessions
* Selecting a session displays the past query/response pairs

## 10. Acceptance Criteria

### 10.1 Authentication
* Users can create an account or log in with valid credentials
* Only logged-in users can access the PDF upload or chat pages

### 10.2 PDF Parsing
* The PDF content is extracted correctly (no major text loss)
* The system can handle typical PDF documents < 10 MB in size

### 10.3 Chat Integration
* Users can ask questions referencing the uploaded PDF content
* The model responds within a reasonable time (< a few seconds)
* Chat sessions are saved for later access

### 10.4 UI/UX
* The application is intuitive (clear upload button, chat box, etc.)
* The UI is responsive and consistent with Tailwind styling

### 10.5 Performance
* The server can handle multiple concurrent requests
* The chat system updates in real-time or near real-time

## 11. Deployment Considerations

### Local Development
* Start the FastAPI server on localhost:8000
* Run Next.js (dev mode) on localhost:3000
* .env file holds API keys, DB connection strings, etc.

### Production
* May require Docker or a serverless approach
* Ensure security best practices (HTTPS, secrets handling, etc.)

## 12. Appendix / Additional Notes

* **Scaling:** If the application is widely used, we might consider advanced caching strategies or a more robust DB
* **Model Serving:** The specifics of calling the Cerebras model (local or remote) is beyond scope. Just ensure a function cerebras_inference_api(prompt) is available in the FastAPI service
* **Example vs. Real Code:** All code snippets here are for demonstration only. Actual implementation might differ in structure, naming, or data flow

## Conclusion

This PRD should provide developers with a clear roadmap for:

1. How the system should behave (user flows, features, acceptance criteria)
2. What the code structure looks like (file/directory layout)
3. How the front-end and back-end communicate (endpoints, example JSON)
4. What the project aims to demonstrate (Cerebras fast inference + PDF Q&A)

By following this document, teams can maintain alignment and deliver a focused, minimal product that showcases the desired features effectively.