import json
import uuid
from typing import List, Dict, Any, Optional, AsyncGenerator

from openai import OpenAI, AsyncOpenAI
from app.core.config import settings
from app.models.chat import ChatMessage, MessageRole, MessageContent, MessageType
from app.core.logger import logger

class LLMService:
    def __init__(self):
        self.client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        self.model = settings.LLM_MODEL
        
        if not settings.OPENAI_API_KEY:
            raise ValueError("OpenAI API key is not configured")
    
    async def generate_completion_stream(
        self,
        messages: List[ChatMessage],
        project_context: Optional[Dict[str, Any]] = None
    ) -> AsyncGenerator[str, None]:
        """
        Generate a streaming chat completion
        
        Args:
            messages: List of chat messages
            project_context: Optional project context
            
        Yields:
            Text chunks from the completion
        """
        try:
            # Convert messages to OpenAI format
            openai_messages = []
            
            # Add system message with project context if available
            if project_context:
                context_message = f"You are assisting with a {project_context.get('technology', '')} project. "
                context_message += f"Current file: {project_context.get('current_file', 'Not specified')}. "
                context_message += f"Project description: {project_context.get('description', 'Not specified')}"
                
                openai_messages.append({
                    "role": "system",
                    "content": context_message
                })
            
            # Add conversation messages
            for msg in messages:
                openai_messages.append({
                    "role": msg.role.value,
                    "content": msg.content
                })
            
            # Generate streaming completion
            stream = await self.client.chat.completions.create(
                model=self.model,
                messages=openai_messages,
                stream=True
            )
            
            async for chunk in stream:
                if chunk.choices[0].delta.content is not None:
                    yield chunk.choices[0].delta.content
                    
        except Exception as e:
            logger.error(f"Error generating streaming completion: {str(e)}")
            raise
    
    async def generate_completion(
        self,
        messages: List[ChatMessage],
        project_context: Optional[Dict[str, Any]] = None
    ) -> ChatMessage:
        """
        Generate a chat completion (uses streaming internally)
        
        Args:
            messages: List of chat messages
            project_context: Optional project context
            
        Returns:
            ChatMessage with the completion
        """
        try:
            # Use streaming to generate the completion
            full_response = ""
            async for chunk in self.generate_completion_stream(messages, project_context):
                full_response += chunk
            
            # Create chat message from the response with a unique ID
            return ChatMessage(
                id=str(uuid.uuid4()),
                role=MessageRole.ASSISTANT,
                content=full_response
            )
            
        except Exception as e:
            logger.error(f"Error generating completion: {str(e)}")
            raise
    
    def _convert_to_openai_messages(
        self, 
        messages: List[ChatMessage], 
        project_context: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        Convert our internal message format to OpenAI format
        """
        openai_messages = []
        
        # Add system message with context if provided
        system_content = "You are a helpful coding assistant that helps with programming tasks and answers questions about code."
        
        if project_context:
            system_content += f"\nYou are currently working on a project with the following details:\n"
            if "name" in project_context:
                system_content += f"Project name: {project_context['name']}\n"
            if "technology" in project_context:
                system_content += f"Technology: {project_context['technology']}\n"
            if "files" in project_context:
                system_content += f"Files: {', '.join(project_context['files'])}\n"
        
        openai_messages.append({
            "role": "system",
            "content": system_content
        })
        
        # Add conversation messages
        for message in messages:
            if message.role in [MessageRole.USER, MessageRole.ASSISTANT]:
                openai_messages.append({
                    "role": message.role.value,
                    "content": message.content
                })
        
        return openai_messages
    
    def _convert_from_openai_message(self, openai_message: Any) -> ChatMessage:
        """
        Convert OpenAI message format to our internal format
        """
        return ChatMessage(
            id=str(uuid.uuid4()),
            role=MessageRole(openai_message.role),
            content=openai_message.content or ""
        )
    
    def _build_system_prompt(self, project_context: Optional[Dict[str, Any]] = None) -> str:
        """
        Build the system prompt with project context
        """
        base_prompt = """
        You are SpeakCode, a voice-first pair programming assistant that helps developers write and understand code.
        
        Your role is to act as a senior engineer who:
        1. Listens to the user's spoken intent
        2. Discusses options and approaches
        3. Suggests code implementations as diffs
        4. Helps with code explanations and debugging
        5. Never writes or commits code without the user's approval
        
        Always explain your reasoning and trade-offs in your suggestions.
        When suggesting code changes, present them as diffs that the user can review.
        When explaining concepts, be clear and concise, focusing on key insights.
        """
        
        # Add project context if available
        if project_context:
            project_files = project_context.get("files", [])
            project_info = project_context.get("info", {})
            
            context_prompt = f"""
            Project information:
            - Name: {project_info.get('name', 'Unknown')}
            - Language: {project_info.get('language', 'Unknown')}
            - Framework: {project_info.get('framework', 'Unknown')}
            
            Project files:
            """
            
            for file in project_files[:10]:  # Limit to 10 files to avoid token limits
                context_prompt += f"- {file.get('path', 'Unknown')}\n"
                
            base_prompt += context_prompt
            
        return base_prompt.strip()
    
    async def analyze_code_diff(self, file_path: str, original: str, modified: str) -> Dict[str, Any]:
        """
        Use the LLM to analyze and explain a code diff
        """
        prompt = f"""
        Analyze the following code diff and explain the changes:
        
        Original file: {file_path}
        
        ```
        {original}
        ```
        
        Modified file:
        
        ```
        {modified}
        ```
        
        Please provide:
        1. A summary of the changes
        2. The impact of these changes
        3. Any potential issues to be aware of
        """
        
        messages = [
            {"role": "system", "content": "You are a helpful code review assistant."},
            {"role": "user", "content": prompt}
        ]
        
        response = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=0.3,
        )
        
        return {
            "explanation": response.choices[0].message.content,
            "file_path": file_path
        }

# Create global LLM service instance
llm_service = LLMService() 