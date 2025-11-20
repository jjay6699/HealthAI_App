import React, { useState, useRef, useEffect } from "react";
import { useTheme } from "../theme";
import OpenAI from "openai";
import { shouldShowPaywall, incrementChatInteractions } from "../services/usageTracker";
import PaywallModal from "./PaywallModal";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AIChatProps {
  onClose: () => void;
}

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

const AIChat: React.FC<AIChatProps> = ({ onClose }) => {
  const theme = useTheme();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hello! I'm your AI Health Advisor, trained on hundreds of thousands of medical journals. How can I help you with your health questions today?\n\nYou can ask me anything about health, nutrition, supplements, or upload your bloodwork for personalized analysis!"
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      const fileMessage: Message = {
        role: "user",
        content: `📎 Uploaded: ${file.name}`
      };
      setMessages(prev => [...prev, fileMessage]);

      // Automatically analyze the file
      analyzeUploadedFile(file);
    }
  };

  const analyzeUploadedFile = async (file: File) => {
    setIsLoading(true);

    try {
      // For demo purposes, we'll simulate file analysis
      // In production, you would use OCR or file parsing
      const analysisMessage: Message = {
        role: "assistant",
        content: `I've received your ${file.type.includes('pdf') ? 'PDF' : 'image'} file "${file.name}".

For a complete analysis, I would need to extract the bloodwork data from this file. In a production environment, this would involve:
- OCR (Optical Character Recognition) to read the document
- Parsing the biomarker values
- Comparing against reference ranges

For now, would you like to:
1. Tell me specific values from your bloodwork that concern you
2. Use our demo analysis feature to see how the AI analyzes bloodwork
3. Ask me general health questions

What would you prefer?`
      };

      setMessages(prev => [...prev, analysisMessage]);
    } catch (error) {
      console.error("Error analyzing file:", error);
      const errorMessage: Message = {
        role: "assistant",
        content: "I encountered an error processing your file. Please try again or describe your bloodwork results to me."
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setUploadedFile(null);
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && !uploadedFile) || isLoading) return;

    if (shouldShowPaywall()) {
      setShowPaywall(true);
      return;
    }

    const userMessage: Message = { role: "user", content: input };
    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput("");
    setIsLoading(true);

    try {
      console.log("Sending message to OpenAI:", currentInput);

      incrementChatInteractions();

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a knowledgeable health advisor trained on hundreds of thousands of medical journals. Provide evidence-based health advice, supplement recommendations, and wellness guidance.

IMPORTANT: When users ask about:
- Their health status or concerns
- Vitamin/mineral deficiencies
- Energy levels, fatigue, or specific symptoms
- Personalized supplement recommendations
- What supplements they should take

You should PROACTIVELY suggest: "For the most accurate and personalized recommendations, I'd suggest uploading your bloodwork using the 📎 attachment button below. This will allow me to analyze your specific biomarkers and provide tailored advice."

If users mention bloodwork values or health concerns, provide specific advice. Always remind users that your advice is educational and they should consult healthcare professionals for medical decisions. Be friendly, clear, and helpful.`
          },
          ...messages.map(m => ({ role: m.role, content: m.content })),
          { role: "user", content: currentInput }
        ],
        temperature: 0.7,
        max_tokens: 500
      });

      console.log("OpenAI response:", response);

      const assistantMessage: Message = {
        role: "assistant",
        content: response.choices[0].message.content || "I apologize, I couldn't generate a response. Please try again."
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Error calling OpenAI:", error);
      console.error("Error details:", JSON.stringify(error, null, 2));
      const errorMessage: Message = {
        role: "assistant",
        content: `I'm sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please check your OpenAI API key.`
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div
      style={{
        position: "fixed" as const,
        inset: 0,
        backgroundColor: "rgba(17, 24, 39, 0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 300,
        padding: theme.spacing.lg
      }}
      onClick={onClose}
    >
      {showPaywall && <PaywallModal onClose={() => setShowPaywall(false)} />}
      <div
        style={{
          width: "100%",
          maxWidth: 600,
          height: "80vh",
          maxHeight: 700,
          background: theme.colors.background,
          borderRadius: 24,
          display: "flex",
          flexDirection: "column" as const,
          overflow: "hidden",
          boxShadow: "0 32px 72px rgba(15,23,42,0.2)"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: `${theme.spacing.lg}px ${theme.spacing.xl}px`,
            borderBottom: `1px solid ${theme.colors.divider}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>AI Health Advisor</h2>
            <p style={{ margin: 0, fontSize: 13, color: theme.colors.textSecondary, marginTop: 4 }}>
              Trained on medical journals
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              fontSize: 24,
              cursor: "pointer",
              color: theme.colors.textSecondary,
              padding: 0,
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            ×
          </button>
        </div>

        {/* Messages */}
        <div
          style={{
            flex: 1,
            overflowY: "auto" as const,
            padding: theme.spacing.xl,
            display: "flex",
            flexDirection: "column" as const,
            gap: theme.spacing.lg
          }}
        >
          {messages.map((message, index) => (
            <div
              key={index}
              style={{
                display: "flex",
                justifyContent: message.role === "user" ? "flex-end" : "flex-start"
              }}
            >
              <div
                style={{
                  maxWidth: "80%",
                  padding: `${theme.spacing.md}px ${theme.spacing.lg}px`,
                  borderRadius: theme.radii.lg,
                  background: message.role === "user" ? theme.colors.primary : theme.colors.surface,
                  color: message.role === "user" ? theme.colors.background : theme.colors.text,
                  fontSize: 15,
                  lineHeight: "22px",
                  whiteSpace: "pre-wrap" as const
                }}
              >
                {message.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <div
                style={{
                  padding: `${theme.spacing.md}px ${theme.spacing.lg}px`,
                  borderRadius: theme.radii.lg,
                  background: theme.colors.surface,
                  color: theme.colors.textSecondary,
                  fontSize: 15
                }}
              >
                Thinking...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div
          style={{
            padding: theme.spacing.lg,
            borderTop: `1px solid ${theme.colors.divider}`,
            background: theme.colors.background
          }}
        >
          <div
            style={{
              display: "flex",
              gap: theme.spacing.sm,
              alignItems: "center"
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileUpload}
              style={{ display: "none" }}
            />
            <button
              onClick={handleAttachClick}
              disabled={isLoading}
              style={{
                padding: `${theme.spacing.sm}px`,
                borderRadius: theme.radii.md,
                border: `1px solid ${theme.colors.divider}`,
                background: theme.colors.surface,
                color: theme.colors.text,
                fontSize: 18,
                cursor: isLoading ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 40,
                height: 40,
                flexShrink: 0
              }}
              title="Attach bloodwork file"
            >
              📎
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask about health, supplements..."
              disabled={isLoading}
              style={{
                flex: 1,
                padding: `${theme.spacing.sm + 2}px ${theme.spacing.md}px`,
                borderRadius: theme.radii.md,
                border: `1px solid ${theme.colors.divider}`,
                fontSize: 15,
                outline: "none",
                fontFamily: "inherit",
                minWidth: 0
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              style={{
                padding: `${theme.spacing.sm + 2}px ${theme.spacing.lg}px`,
                borderRadius: theme.radii.md,
                border: "none",
                background: input.trim() && !isLoading ? theme.colors.primary : theme.colors.divider,
                color: theme.colors.background,
                fontSize: 15,
                fontWeight: 600,
                cursor: input.trim() && !isLoading ? "pointer" : "not-allowed",
                fontFamily: "inherit",
                flexShrink: 0,
                whiteSpace: "nowrap" as const
              }}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIChat;

