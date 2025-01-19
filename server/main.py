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
import uuid

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

def create_chunks_with_overlap(sentences: List[str], max_tokens: int = 4000, overlap_sentences: int = 5) -> List[TextChunk]:
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
            
            # Start new chunk with overlap for better context
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

def preprocess_text(text: str) -> List[str]:
    """Clean and normalize text, returning list of words."""
    # Convert to lowercase and split into words
    words = re.findall(r'\w+', text.lower())
    # Remove common words that don't add meaning
    stop_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'}
    return [w for w in words if w not in stop_words]

def calculate_chunk_score(query_words: List[str], chunk_words: List[str]) -> float:
    """Calculate relevance score between query and chunk using TF-IDF-like scoring."""
    # Convert to sets for intersection
    query_set = set(query_words)
    chunk_set = set(chunk_words)
    
    # Calculate word overlap
    matching_words = query_set.intersection(chunk_set)
    
    if not matching_words:
        return 0.0
    
    # Count word frequencies in chunk
    chunk_freq = {}
    for word in chunk_words:
        chunk_freq[word] = chunk_freq.get(word, 0) + 1
    
    # Calculate score based on:
    # 1. Number of matching unique words (coverage)
    # 2. Frequency of matching words in chunk (relevance)
    # 3. Proximity of matches to start of chunk (position bias)
    coverage_score = len(matching_words) / len(query_set)
    
    relevance_score = sum(chunk_freq[word] for word in matching_words) / len(chunk_words)
    
    return (coverage_score + relevance_score) / 2

def find_relevant_chunks(query: str, chunks: List[TextChunk], max_total_tokens: int = 7000) -> List[TextChunk]:
    """Find the most relevant chunks that fit within the token limit."""
    if not chunks:
        return []
    
    # Preprocess query and chunks
    query_words = preprocess_text(query)
    chunk_words = [preprocess_text(chunk.text) for chunk in chunks]
    
    # Calculate scores for each chunk
    scores = [calculate_chunk_score(query_words, words) for words in chunk_words]
    
    # Sort chunks by score
    scored_chunks = list(zip(scores, chunks))
    scored_chunks.sort(key=lambda x: x[0], reverse=True)
    
    # Select chunks until we hit the token limit
    selected_chunks = []
    total_tokens = 0
    
    for score, chunk in scored_chunks:
        if score == 0:  # Skip irrelevant chunks
            continue
        if total_tokens + chunk.token_count > max_total_tokens:
            break
        selected_chunks.append(chunk)
        total_tokens += chunk.token_count
    
    return selected_chunks

# Load environment variables from .env file
load_dotenv()

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Local development
        "https://cerebrasinference-production.up.railway.app/"  # Railway production URL
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

# Dictionary to store PDF contents for each session
pdf_contents: Dict[str, List[TextChunk]] = {}

class PromptRequest(BaseModel):
    session_id: Optional[str] = None
    prompt: str
    mode: str = "chat"  # "chat" or "pdf"

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
        
        # Generate a session ID
        session_id = str(uuid.uuid4())
        
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

@app.post("/api/create-session")
async def create_session() -> Dict[str, str]:
    try:
        session_id = str(uuid.uuid4())
        return {
            "status": "success",
            "session_id": session_id
        }
    except Exception as e:
        logger.error(f"Error creating session: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/chat")
async def chat(request: PromptRequest) -> Dict[str, str]:
    logger.info(f"Received chat request for mode: {request.mode}")
    logger.info(f"Question: {request.prompt}")
    
    try:
        # Set up the messages list
        messages = []
        
        # Add system message based on mode
        if request.mode == "pdf":
            if not request.session_id or request.session_id not in pdf_contents:
                logger.error(f"PDF session not found: {request.session_id}")
                raise HTTPException(status_code=404, detail="PDF session not found")
            
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
            
            # System message for PDF mode
            messages.append({
                "role": "system",
                "content": """You are an AI assistant that provides well-structured, comprehensive answers about PDF documents. Follow these formatting guidelines:

1. Start with a brief summary or key point (1-2 sentences)
2. Use markdown formatting:
   - **Bold** for important concepts
   - Organize information into sections with ### headings
   - Use bullet points or numbered lists for multiple items
   - Use `code blocks` for technical terms or citations
3. Structure longer responses into clear sections:
   - Main Points/Summary
   - Details/Analysis
   - Examples/Evidence (with quotes when relevant)
   - Additional Context (if applicable)
4. End with a brief conclusion or key takeaway

Analyze all provided excerpts thoroughly and create well-organized, easy-to-read responses."""
            })
            
            # Add context message with PDF content
            messages.append({
                "role": "user",
                "content": f"""Here are relevant excerpts from the document:

{combined_text}

Please provide a detailed, well-structured answer to the following question, incorporating information from all relevant excerpts. Use appropriate markdown formatting and organize your response into clear sections:"""
            })
        else:
            # System message for regular chat mode
            messages.append({
                "role": "system",
                "content": """You are a helpful AI assistant. Be concise, friendly, and direct in your responses. Use markdown formatting when it helps with clarity:
- **Bold** for emphasis
- Lists for multiple points
- ### Headers for sections
- `code` for technical terms"""
            })
        
        # Add user's question
        messages.append({
            "role": "user",
            "content": request.prompt
        })
        
        # Log message lengths
        total_tokens = sum(count_tokens(msg["content"]) for msg in messages)
        logger.info(f"Total tokens: {total_tokens}")
        
        # Call Cerebras API
        chat_completion = cerebras_client.chat.completions.create(
            model="llama3.3-70b",
            messages=messages,
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
