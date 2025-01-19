from fastapi import FastAPI, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pdfplumber
import io
from typing import Dict, List
from pydantic import BaseModel
import os
from cerebras.cloud.sdk import Cerebras
from dotenv import load_dotenv
import logging
import traceback
from typing import List, Tuple
import re

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def split_text_into_chunks(text: str, chunk_size: int = 8192) -> List[str]:
    """Split text into chunks of approximately chunk_size characters."""
    # Split by paragraphs first
    paragraphs = text.split('\n\n')
    chunks = []
    current_chunk = ""
    
    for para in paragraphs:
        if len(current_chunk) + len(para) < chunk_size:
            current_chunk += para + "\n\n"
        else:
            if current_chunk:
                chunks.append(current_chunk)
            current_chunk = para + "\n\n"
    
    if current_chunk:
        chunks.append(current_chunk)
    
    return chunks

def find_most_relevant_chunks(query: str, chunks: List[str], max_chunks: int = 1) -> List[str]:
    """Find the most relevant chunks for a given query using simple keyword matching."""
    # Convert query to lowercase and split into words
    query_words = set(re.findall(r'\w+', query.lower()))
    
    # Score each chunk based on word overlap
    chunk_scores: List[Tuple[int, str]] = []
    for chunk in chunks:
        chunk_words = set(re.findall(r'\w+', chunk.lower()))
        score = len(query_words.intersection(chunk_words))
        chunk_scores.append((score, chunk))
    
    # Sort by score and take top chunks
    chunk_scores.sort(reverse=True)
    # Only take one chunk to stay within limits
    return [chunk for _, chunk in chunk_scores[:max_chunks]]

# Load environment variables from .env file
load_dotenv()

app = FastAPI()

# Initialize Cerebras client
api_key = os.environ.get("CEREBRAS_API_KEY")
if not api_key:
    logger.error("CEREBRAS_API_KEY not found in environment variables")
    raise ValueError("CEREBRAS_API_KEY not found")

try:
    cerebras_client = Cerebras(api_key=api_key)
    logger.info("Successfully initialized Cerebras client")
except Exception as e:
    logger.error(f"Failed to initialize Cerebras client: {str(e)}")
    raise

# Configure CORS for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage for PDF content
pdf_contents = {}

class PromptRequest(BaseModel):
    session_id: str
    prompt: str

class Message(BaseModel):
    role: str
    content: str

@app.post("/api/upload-pdf")
async def upload_pdf(file: UploadFile) -> Dict[str, str]:
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="File must be a PDF")
    
    try:
        logger.info(f"Processing upload for file: {file.filename}")
        # Read the uploaded file into memory
        contents = await file.read()
        
        # Use pdfplumber to extract text
        with pdfplumber.open(io.BytesIO(contents)) as pdf:
            text = ""
            for page in pdf.pages:
                text += page.extract_text() or ""
        
        if not text.strip():
            raise HTTPException(status_code=400, detail="Could not extract text from PDF")
        
        # Generate a session ID (in production, use a more secure method)
        session_id = file.filename.replace('.pdf', '')
        
        # Split text into chunks and store them
        chunks = split_text_into_chunks(text)
        pdf_contents[session_id] = chunks
        
        logger.info(f"Successfully processed PDF. Session ID: {session_id}, Number of chunks: {len(chunks)}")
        
        return {
            "status": "success",
            "session_id": session_id,
            "filename": file.filename
        }
    
    except Exception as e:
        logger.error(f"Error processing PDF: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/chat")
async def chat(request: PromptRequest) -> Dict[str, str]:
    logger.info(f"Received chat request for session: {request.session_id}")
    
    if request.session_id not in pdf_contents:
        logger.error(f"Session not found: {request.session_id}")
        raise HTTPException(status_code=404, detail="Session not found")
    
    try:
        # Get the PDF chunks
        chunks = pdf_contents[request.session_id]
        logger.info(f"Found {len(chunks)} chunks for session {request.session_id}")
        
        # Find most relevant chunks for the query
        relevant_chunks = find_most_relevant_chunks(request.prompt, chunks)
        combined_chunks = "\n\n".join(relevant_chunks)
        
        logger.info(f"Selected {len(relevant_chunks)} relevant chunks, total length: {len(combined_chunks)}")
        
        # Construct a shorter system message
        system_message = {
            "role": "system",
            "content": "You are an AI assistant that answers questions about PDF documents. Base answers only on the provided excerpts."
        }
        
        # Create a context message with the relevant chunks
        context_message = {
            "role": "user",
            "content": f"Here are relevant excerpts from the document:\n\n{combined_chunks}\n\nPlease answer the following question based only on these excerpts."
        }
        
        # User's question
        user_message = {
            "role": "user",
            "content": request.prompt
        }
        
        # Log message lengths
        logger.info(f"System message length: {len(system_message['content'])}")
        logger.info(f"Context message length: {len(context_message['content'])}")
        logger.info(f"User message length: {len(user_message['content'])}")
        
        total_length = len(system_message['content']) + len(context_message['content']) + len(user_message['content'])
        logger.info(f"Total message length: {total_length}")
        
        # Call Cerebras API
        chat_completion = cerebras_client.chat.completions.create(
            model="llama3.3-70b",
            messages=[system_message, context_message, user_message],
            temperature=0.2,
            max_completion_tokens=1024
        )
        
        # Extract the response
        response = chat_completion.choices[0].message.content
        logger.info(f"Successfully received response from Cerebras API: {response[:100]}...")
        
        return {
            "response": response
        }
    
    except Exception as e:
        error_msg = f"Error in chat endpoint: {str(e)}\n{traceback.format_exc()}"
        logger.error(error_msg)
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
