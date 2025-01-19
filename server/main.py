from fastapi import FastAPI, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pdfplumber
import io
from typing import Dict, List, Tuple, Optional
from pydantic import BaseModel
import os
from cerebras.cloud.sdk import Cerebras
from dotenv import load_dotenv
import logging
import traceback
import re
import tiktoken
import numpy as np
from dataclasses import dataclass

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class TextChunk:
    text: str
    token_count: int
    embedding: Optional[np.ndarray] = None

def count_tokens(text: str, model: str = "gpt-3.5-turbo") -> int:
    """Count the number of tokens in a text string."""
    encoding = tiktoken.encoding_for_model(model)
    return len(encoding.encode(text))

def split_into_sentences(text: str) -> List[str]:
    """Split text into sentences using regex."""
    # This pattern matches sentence boundaries
    pattern = r'(?<=[.!?])\s+'
    sentences = re.split(pattern, text)
    return [s.strip() for s in sentences if s.strip()]

def create_chunks_with_overlap(sentences: List[str], max_tokens: int = 2000, overlap_sentences: int = 2) -> List[TextChunk]:
    """Create chunks of text that respect token limits with sentence overlap."""
    chunks = []
    current_chunk = []
    current_token_count = 0
    
    for i in range(len(sentences)):
        sentence = sentences[i]
        sentence_tokens = count_tokens(sentence)
        
        # If adding this sentence would exceed the limit, save the current chunk
        if current_token_count + sentence_tokens > max_tokens and current_chunk:
            chunk_text = " ".join(current_chunk)
            chunks.append(TextChunk(text=chunk_text, token_count=current_token_count))
            
            # Start new chunk with overlap
            overlap_start = max(0, len(current_chunk) - overlap_sentences)
            current_chunk = current_chunk[overlap_start:]
            current_token_count = count_tokens(" ".join(current_chunk))
        
        current_chunk.append(sentence)
        current_token_count = count_tokens(" ".join(current_chunk))
    
    # Add the last chunk if it's not empty
    if current_chunk:
        chunk_text = " ".join(current_chunk)
        chunks.append(TextChunk(text=chunk_text, token_count=current_token_count))
    
    return chunks

def find_relevant_chunks(query: str, chunks: List[TextChunk], max_total_tokens: int = 6000) -> List[TextChunk]:
    """Find the most relevant chunks that fit within the token limit."""
    # Score chunks based on word overlap (we can make this more sophisticated later)
    query_words = set(re.findall(r'\w+', query.lower()))
    logger.info(f"Query words: {query_words}")
    
    scored_chunks = []
    
    for i, chunk in enumerate(chunks):
        chunk_words = set(re.findall(r'\w+', chunk.text.lower()))
        score = len(query_words.intersection(chunk_words))
        logger.info(f"Chunk {i} score: {score} (words: {len(chunk_words)})")
        # Always add the chunk with its score
        scored_chunks.append((score, chunk))
    
    # Sort by score only (not the TextChunk objects)
    scored_chunks.sort(key=lambda x: x[0], reverse=True)
    logger.info(f"Top scores: {[score for score, _ in scored_chunks[:3]]}")
    
    # Select chunks that fit within the token limit
    selected_chunks = []
    total_tokens = 0
    
    for score, chunk in scored_chunks:
        if total_tokens + chunk.token_count <= max_total_tokens:
            selected_chunks.append(chunk)
            total_tokens += chunk.token_count
            logger.info(f"Selected chunk with score {score}, tokens: {chunk.token_count}, total tokens now: {total_tokens}")
        else:
            logger.info(f"Stopping chunk selection at {total_tokens} tokens")
            break
    
    if not selected_chunks:
        logger.info("No chunks fit within token limit, using first chunk truncated")
        first_chunk = chunks[0]
        # If we can't fit any chunks, at least return the first one
        return [first_chunk]
    
    return selected_chunks

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
pdf_contents: Dict[str, List[TextChunk]] = {}

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
        
        logger.info(f"Extracted text length: {len(text)} characters")
        
        # Generate a session ID (in production, use a more secure method)
        session_id = file.filename.replace('.pdf', '')
        
        # Process the text into chunks
        sentences = split_into_sentences(text)
        logger.info(f"Split text into {len(sentences)} sentences")
        
        chunks = create_chunks_with_overlap(sentences)
        logger.info(f"Created {len(chunks)} chunks from PDF")
        
        # Log some sample chunks for debugging
        for i, chunk in enumerate(chunks[:2]):
            logger.info(f"Sample chunk {i}: {chunk.token_count} tokens")
            logger.info(f"First 100 chars: {chunk.text[:100]}")
        
        # Store the chunks
        pdf_contents[session_id] = chunks
        
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
    logger.info(f"Question: {request.prompt}")
    
    if request.session_id not in pdf_contents:
        logger.error(f"Session not found: {request.session_id}")
        raise HTTPException(status_code=404, detail="Session not found")
    
    try:
        # Get the chunks for this session
        chunks = pdf_contents[request.session_id]
        logger.info(f"Found {len(chunks)} chunks for session {request.session_id}")
        
        # Find relevant chunks that fit within our token budget
        relevant_chunks = find_relevant_chunks(request.prompt, chunks)
        logger.info(f"Found {len(relevant_chunks)} relevant chunks")
        
        if not relevant_chunks:
            logger.error("No relevant chunks found!")
            return {"response": "I couldn't find any relevant information in the document to answer your question. Could you please rephrase your question or ask about a different topic?"}
        
        # Log the first relevant chunk for debugging
        if relevant_chunks:
            logger.info(f"First relevant chunk ({relevant_chunks[0].token_count} tokens): {relevant_chunks[0].text[:200]}")
        
        combined_text = "\n\n".join(chunk.text for chunk in relevant_chunks)
        total_tokens = sum(chunk.token_count for chunk in relevant_chunks)
        logger.info(f"Selected {len(relevant_chunks)} relevant chunks, total tokens: {total_tokens}")
        
        # Construct a shorter system message
        system_message = {
            "role": "system",
            "content": "You are an AI assistant that answers questions about PDF documents. Base answers only on the provided excerpts."
        }
        
        # Create a context message with the relevant chunks
        context_message = {
            "role": "user",
            "content": f"Here are relevant excerpts from the document:\n\n{combined_text}\n\nPlease answer the following question based only on these excerpts."
        }
        
        # User's question
        user_message = {
            "role": "user",
            "content": request.prompt
        }
        
        # Log message lengths
        system_tokens = count_tokens(system_message["content"])
        context_tokens = count_tokens(context_message["content"])
        user_tokens = count_tokens(user_message["content"])
        total_tokens = system_tokens + context_tokens + user_tokens
        
        logger.info(f"System message tokens: {system_tokens}")
        logger.info(f"Context message tokens: {context_tokens}")
        logger.info(f"User message tokens: {user_tokens}")
        logger.info(f"Total tokens: {total_tokens}")
        logger.info(f"User question: {request.prompt}")
        
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
