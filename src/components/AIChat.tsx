import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../i18n";
import { useTheme } from "../theme";
import { AVAILABLE_SUPPLEMENTS } from "../data/supplements";
import { analyzeBloodworkFile, analyzeBloodworkPdf, analyzeBloodworkImages } from "../services/openai";
import { persistentStorage } from "../services/persistentStorage";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AIChatProps {
  onClose: () => void;
}

const AIChat: React.FC<AIChatProps> = ({ onClose }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { language } = useI18n();
  const isChinese = language === "zh";
  const text = {
    welcome: isChinese
      ? "你好，我是你的 AI 健康顾问，基于大量医学期刊内容进行训练。今天想咨询什么健康问题？\n\n你可以问我健康、营养相关的问题，或上传血液报告获得个性化分析。"
      : "Hello! I'm your AI Health Advisor, trained on hundreds of thousands of medical journals. How can I help you with your health questions today?\n\nYou can ask me anything about health, nutrition, or upload your bloodwork for personalized analysis!",
    uploadedFiles: (count: number, names: string) =>
      isChinese ? `已上传 ${count} 个文件：${names}` : `Uploaded ${count} file(s): ${names}`,
    uploadPrompt: isChinese ? "这是你想分析的血液报告吗？" : "Is this a blood report you want analyzed?",
    personalizePrompt: isChinese
      ? "你愿意先回答一个简短问卷，让建议更个性化吗？"
      : "Would you like to answer a short questionnaire to personalize your guidance?",
    uploadBloodworkPrompt: isChinese
      ? "你想上传血液报告，以获得更准确的建议和更详细的解读吗？"
      : "Would you like to upload your bloodwork for more accurate recommendations and a detailed reading?",
    declineQuestionnaire: isChinese ? "不用了，继续聊天即可。" : "No thanks, continue without the questionnaire.",
    under18Notice: isChinese
      ? "感谢告知。本问卷仅适用于 18 岁及以上用户。你仍然可以继续咨询其他健康问题。"
      : "Thanks for letting me know. This questionnaire is only for users 18+. Feel free to ask any other questions.",
    fileProcessError: isChinese
      ? "处理你的文件时出现错误。请重试，或直接告诉我你的血液检测结果。"
      : "I encountered an error processing your file. Please try again or describe your bloodwork results to me.",
    mixedFileError: isChinese
      ? "请上传单个 PDF，或上传多张图片，不要混合上传。"
      : "Please upload either a single PDF or multiple images, not a mix of files.",
    pdfInChatError: isChinese
      ? "这里可以分析图片，但 PDF 需要使用血液报告分析器。请改为上传清晰图片。"
      : "I can analyze images here, but PDFs need the blood report analyzer. Please upload a clear image instead.",
    imageAnalyzePrompt: isChinese
      ? "请分析这张图片，并用通俗易懂的语言说明你看到的内容。"
      : "Analyze this image and explain what it shows in plain language.",
    imageAnalyzeFallback: isChinese ? "我暂时无法分析这张图片。请换一张再试。" : "I couldn't analyze that image. Please try another one.",
    imageAnalyzeError: isChinese ? "分析这张图片时出现错误，请再试一次。" : "I ran into an error analyzing that image. Please try again.",
    imagesAnalyzePrompt: isChinese
      ? "请综合分析所有图片，并用通俗易懂的语言给出一份整体说明。"
      : "Analyze all images together and provide one overall report in plain language.",
    imagesAnalyzeFallback: isChinese ? "我暂时无法分析这些图片。请换一组再试。" : "I couldn't analyze those images. Please try another set.",
    imagesAnalyzeError: isChinese ? "分析这些图片时出现错误，请再试一次。" : "I ran into an error analyzing those images. Please try again.",
    imagesProcessError: isChinese ? "处理这些图片时出现错误，请再试一次。" : "I encountered an error processing those images. Please try again.",
    genericFallback: isChinese ? "抱歉，我暂时无法生成回复。请再试一次。" : "I apologize, I couldn't generate a response. Please try again.",
    genericError: (message: string) =>
      isChinese
        ? `抱歉，我遇到了一些错误：${message}。请检查你的 OpenAI API key。`
        : `I'm sorry, I encountered an error: ${message}. Please try again shortly.`,
    title: isChinese ? "AI 健康顾问" : "AI Health Advisor",
    subtitle: isChinese ? "基于医学期刊训练" : "Trained on medical journals",
    bloodReportTitle: isChinese ? "这是血液报告吗？" : "Is this a blood report?",
    yesAnalyze: isChinese ? "是，开始分析" : "Yes, analyze",
    noNotBlood: isChinese ? "不是" : "No, it's not",
    questionnaireTitle: isChinese ? "简短问卷？" : "Quick questionnaire?",
    yes: isChinese ? "是" : "Yes",
    no: isChinese ? "否" : "No",
    back: isChinese ? "返回" : "Back",
    next: isChinese ? "下一步" : "Next",
    finish: isChinese ? "完成" : "Finish",
    thinking: isChinese ? "思考中..." : "Thinking...",
    attachTitle: isChinese ? "上传血液报告文件" : "Attach bloodwork file",
    inputPlaceholder: isChinese ? "咨询健康、营养相关问题..." : "Ask about health, nutrition...",
    send: isChinese ? "发送" : "Send",
    aiLanguageInstruction: isChinese
      ? "Respond entirely in Simplified Chinese. Keep the tone clear, natural, and medically responsible."
      : "Respond entirely in English. Keep the tone clear, natural, and medically responsible."
  };
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: text.welcome
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [pendingUploads, setPendingUploads] = useState<File[]>([]);
  const [showUploadPrompt, setShowUploadPrompt] = useState(false);
  const [showQuestionnairePrompt, setShowQuestionnairePrompt] = useState(false);
  const [questionnaireActive, setQuestionnaireActive] = useState(false);
  const [questionnaireStep, setQuestionnaireStep] = useState(0);
  const [questionnaireCompleted, setQuestionnaireCompleted] = useState(false);
  const [questionnaireDismissed, setQuestionnaireDismissed] = useState(false);
  const [questionnaire, setQuestionnaire] = useState({
    eligibility18Plus: "",
    ageRange: "",
    gender: "",
    heightRange: "",
    weightRange: "",
    primaryGoals: [] as string[],
    activityLevel: "",
    exerciseTypes: [] as string[],
    sleepDuration: "",
    stressLevel: "",
    dietPreference: "",
    caffeineIntake: "",
    sensitivities: [] as string[],
    allergies: "",
    pregnantOrBreastfeeding: "",
    takingMedications: "",
    confirmDisclaimer: false,
    confirmAccuracy: false
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    setMessages((prev) => {
      if (prev.length !== 1 || prev[0]?.role !== "assistant") return prev;
      return [{ role: "assistant", content: text.welcome }];
    });
  }, [text.welcome]);



  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    setUploadedFile(files[0]);
    setPendingUploads((prev) => {
      const merged = new Map(
        prev.map((file) => [`${file.name}:${file.size}:${file.lastModified}`, file] as const)
      );
      for (const file of files) {
        merged.set(`${file.name}:${file.size}:${file.lastModified}`, file);
      }
      return Array.from(merged.values());
    });
    const fileNames = files.map((file) => file.name).join(", ");
    const fileMessage: Message = {
      role: "user",
      content: `📎 Uploaded ${files.length} file(s): ${fileNames}`
    };
    setMessages((prev) => {
      const next = [...prev, fileMessage];
      if (!showUploadPrompt) {
        next.push({ role: "assistant", content: text.uploadPrompt });
      }
      return next;
    });
    setShowUploadPrompt(true);
    event.target.value = "";
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
    });
  };

  const stripDisclaimers = (text: string) => {
    const patterns = [
      /remember,\s*my advice is educational[\s\S]*?medical decisions\.?/gi,
      /my advice is educational[\s\S]*?medical decisions\.?/gi,
      /consult (with )?a healthcare professional(s)?[\s\S]*?\./gi,
      /seek (medical )?advice from (a )?professional(s)?[\s\S]*?\./gi,
      /this is not medical advice[\s\S]*?\./gi,
      /for medical advice[^.]*\./gi
    ];

    return patterns.reduce((acc, pattern) => acc.replace(pattern, "").trim(), text);
  };

  const createChatCompletion = async (payload: {
    model: string;
    messages: Array<{ role: string; content: unknown }>;
    temperature?: number;
    max_tokens?: number;
  }) => {
    const response = await fetch("/api/ai/chat-completions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json() as Promise<{
      choices: Array<{
        message: {
          content: string | null;
        };
      }>;
    }>;
  };

  const analyzeImageInChat = async (file: File) => {
    setIsLoading(true);

    try {
      const base64 = await fileToBase64(file);
      const response = await createChatCompletion({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a helpful health assistant. ${text.aiLanguageInstruction} Describe visible details precisely, mention plausible non-diagnostic possibilities, and suggest safe next steps. Be concise but complete (4-7 sentences). Avoid markdown/bold and do not end mid-sentence.`
          },
          {
            role: "user",
            content: [
              { type: "text", text: text.imageAnalyzePrompt },
              {
                type: "image_url",
                image_url: { url: `data:${file.type || "image/jpeg"};base64,${base64}` }
              }
            ]
          }
        ],
        temperature: 0.3,
        max_tokens: 800
      });

      const assistantMessage: Message = {
        role: "assistant",
        content: stripDisclaimers(
          response.choices[0].message.content || text.imageAnalyzeFallback
        )
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Error analyzing image:", error);
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: text.imageAnalyzeError }
      ]);
    } finally {
      setIsLoading(false);
      setUploadedFile(null);
      setPendingUploads([]);
    }
  };

  const analyzeUploadedFile = async (file: File) => {
    setIsLoading(true);

    try {
      let analysis;
      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        analysis = await analyzeBloodworkPdf(file);
      } else {
        const base64 = await fileToBase64(file);
        analysis = await analyzeBloodworkFile(base64, file.type);
      }

      persistentStorage.setItem("bloodworkAnalysis", JSON.stringify(analysis));
      persistentStorage.setItem(
        "bloodworkAnalysisMeta",
        JSON.stringify({
          uploadedAt: new Date().toISOString(),
          fileName: file.name,
          fileType: file.type || "unknown",
          fileSize: file.size
        })
      );

      navigate("/insights");
    } catch (error) {
      console.error("Error analyzing file:", error);
      const errorMessage: Message = {
        role: "assistant",
        content: text.fileProcessError
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setUploadedFile(null);
      setPendingUploads([]);
    }
  };

  const sendMessageToAI = async (content: string) => {
    setIsLoading(true);

    try {
      console.log("Sending message to OpenAI:", content);
      const supplementsList = AVAILABLE_SUPPLEMENTS.map((s) => s.name).join(", ");
      const response = await createChatCompletion({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a knowledgeable health advisor trained on hundreds of thousands of medical journals. ${text.aiLanguageInstruction} Provide evidence-based health advice, nutrition recommendations, and wellness guidance.

IMPORTANT: When users ask about:
- Their health status or concerns
- Vitamin/mineral deficiencies
- Energy levels, fatigue, or specific symptoms
- Personalized nutrition recommendations
- What nutrition products they should take

You should PROACTIVELY suggest: "For the most accurate and personalized recommendations, I'd suggest uploading your bloodwork using the 📎 attachment button below. This will allow me to analyze your specific biomarkers and provide tailored advice."

If users mention bloodwork values or health concerns, provide specific advice. Be friendly, clear, and helpful.

If you need more context before giving tailored guidance, ask: "${text.personalizePrompt}"

If you recommend nutrition products, ONLY use items from this list: ${supplementsList}.
Do not recommend anything outside the list.
Do not use markdown or bold formatting (no **). Use plain text only.`
          },
          ...messages.map(m => ({ role: m.role, content: m.content })),
          { role: "user", content: `${content}\n\nQuestionnaire completed: ${questionnaireCompleted ? "yes" : "no"}` }
        ],
        temperature: 0.7,
        max_tokens: 500
      });

      console.log("OpenAI response:", response);

      const cleanedContent = stripDisclaimers(
        response.choices[0].message.content || text.genericFallback
      );

      const assistantMessage: Message = {
        role: "assistant",
        content: cleanedContent
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Error calling OpenAI:", error);
      console.error("Error details:", JSON.stringify(error, null, 2));
      const errorMessage: Message = {
        role: "assistant",
        content: text.genericError(error instanceof Error ? error.message : "Unknown error")
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && !uploadedFile) || isLoading) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput("");

    const isGreeting = /^(hi|hello|hey|good morning|good afternoon|good evening|你好|您好)\b/i.test(currentInput.trim());
    if (isGreeting && !questionnaireCompleted && !questionnaireDismissed && !questionnaireActive) {
      const promptMessage: Message = {
        role: "assistant",
        content: text.personalizePrompt
      };
      setMessages(prev => [...prev, promptMessage]);
      setShowQuestionnairePrompt(true);
      return;
    }

    await sendMessageToAI(currentInput);
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

  const toggleMultiSelect = (list: string[], value: string) => {
    if (list.includes(value)) {
      return list.filter((item) => item !== value);
    }
    return [...list, value];
  };

  const questionnaireSteps = [
    {
      id: "eligibility",
      title: "Eligibility",
      body: (
        <div style={styles.fieldGroup}>
          <label style={styles.fieldLabel}>Are you 18 years of age or older?</label>
          <div style={styles.optionRow}>
            {["Yes", "No"].map((value) => (
              <label key={value} style={styles.optionLabel}>
                <input
                  type="radio"
                  name="eligibility18Plus"
                  value={value}
                  checked={questionnaire.eligibility18Plus === value}
                  onChange={(e) => setQuestionnaire(prev => ({ ...prev, eligibility18Plus: e.target.value }))}
                />
                <span>{value}</span>
              </label>
            ))}
          </div>
        </div>
      )
    },
    {
      id: "basic",
      title: "Basic Information",
      body: (
        <div style={styles.fieldGroup}>
          <label style={styles.fieldLabel}>Age range</label>
          <div style={styles.optionGrid}>
            {["18-24", "25-34", "35-44", "45-54", "55+"].map((value) => (
              <label key={value} style={styles.optionLabel}>
                <input
                  type="radio"
                  name="ageRange"
                  value={value}
                  checked={questionnaire.ageRange === value}
                  onChange={(e) => setQuestionnaire(prev => ({ ...prev, ageRange: e.target.value }))}
                />
                <span>{value}</span>
              </label>
            ))}
          </div>

          <label style={styles.fieldLabel}>Gender</label>
          <div style={styles.optionGrid}>
            {["Male", "Female", "Prefer not to say"].map((value) => (
              <label key={value} style={styles.optionLabel}>
                <input
                  type="radio"
                  name="gender"
                  value={value}
                  checked={questionnaire.gender === value}
                  onChange={(e) => setQuestionnaire(prev => ({ ...prev, gender: e.target.value }))}
                />
                <span>{value}</span>
              </label>
            ))}
          </div>

          <label style={styles.fieldLabel}>Height (cm)</label>
          <div style={styles.optionGrid}>
            {["Under 155 cm", "155-167 cm", "168-180 cm", "181+ cm"].map((value) => (
              <label key={value} style={styles.optionLabel}>
                <input
                  type="radio"
                  name="heightRange"
                  value={value}
                  checked={questionnaire.heightRange === value}
                  onChange={(e) => setQuestionnaire(prev => ({ ...prev, heightRange: e.target.value }))}
                />
                <span>{value}</span>
              </label>
            ))}
          </div>
        </div>
      )
    },
    {
      id: "goals",
      title: "Primary goals (select up to 3)",
      body: (
        <div style={styles.fieldGroup}>
          <label style={styles.fieldLabel}>What are your main goals?</label>
          <div style={styles.optionGrid}>
            {[
              "Energy & stamina",
              "Focus & mental clarity",
              "Stress support & relaxation",
              "Sleep quality",
              "Muscle building",
              "Fat management",
              "Gut & digestion support",
              "Immune support",
              "General wellness"
            ].map((value) => (
              <label key={value} style={styles.optionLabel}>
                <input
                  type="checkbox"
                  checked={questionnaire.primaryGoals.includes(value)}
                  onChange={() =>
                    setQuestionnaire(prev => ({
                      ...prev,
                      primaryGoals:
                        prev.primaryGoals.length >= 3 && !prev.primaryGoals.includes(value)
                          ? prev.primaryGoals
                          : toggleMultiSelect(prev.primaryGoals, value)
                    }))
                  }
                />
                <span>{value}</span>
              </label>
            ))}
          </div>
        </div>
      )
    },
    {
      id: "body",
      title: "Body & activity",
      body: (
        <div style={styles.fieldGroup}>
          <label style={styles.fieldLabel}>Weight range (kg)</label>
          <div style={styles.optionGrid}>
            {["Under 59 kg", "59-77 kg", "78-95 kg", "96+ kg"].map((value) => (
              <label key={value} style={styles.optionLabel}>
                <input
                  type="radio"
                  name="weightRange"
                  value={value}
                  checked={questionnaire.weightRange === value}
                  onChange={(e) => setQuestionnaire(prev => ({ ...prev, weightRange: e.target.value }))}
                />
                <span>{value}</span>
              </label>
            ))}
          </div>

          <label style={styles.fieldLabel}>Activity level</label>
          <div style={styles.optionGrid}>
            {["Sedentary", "Lightly active", "Moderately active", "Very active"].map((value) => (
              <label key={value} style={styles.optionLabel}>
                <input
                  type="radio"
                  name="activityLevel"
                  value={value}
                  checked={questionnaire.activityLevel === value}
                  onChange={(e) => setQuestionnaire(prev => ({ ...prev, activityLevel: e.target.value }))}
                />
                <span>{value}</span>
              </label>
            ))}
          </div>

          <label style={styles.fieldLabel}>Exercise type (select all that apply)</label>
          <div style={styles.optionGrid}>
            {["Strength training", "Cardio", "Sports", "Yoga / mobility", "None currently"].map((value) => (
              <label key={value} style={styles.optionLabel}>
                <input
                  type="checkbox"
                  checked={questionnaire.exerciseTypes.includes(value)}
                  onChange={() => setQuestionnaire(prev => ({
                    ...prev,
                    exerciseTypes: toggleMultiSelect(prev.exerciseTypes, value)
                  }))}
                />
                <span>{value}</span>
              </label>
            ))}
          </div>
        </div>
      )
    },
    {
      id: "lifestyle",
      title: "Lifestyle",
      body: (
        <div style={styles.fieldGroup}>
          <label style={styles.fieldLabel}>Average sleep per night</label>
          <div style={styles.optionGrid}>
            {["Under 5 hrs", "5-6 hrs", "6-7 hrs", "7-8 hrs", "8+ hrs"].map((value) => (
              <label key={value} style={styles.optionLabel}>
                <input
                  type="radio"
                  name="sleepDuration"
                  value={value}
                  checked={questionnaire.sleepDuration === value}
                  onChange={(e) => setQuestionnaire(prev => ({ ...prev, sleepDuration: e.target.value }))}
                />
                <span>{value}</span>
              </label>
            ))}
          </div>

          <label style={styles.fieldLabel}>How would you rate your stress level?</label>
          <div style={styles.optionGrid}>
            {["Low", "Moderate", "High"].map((value) => (
              <label key={value} style={styles.optionLabel}>
                <input
                  type="radio"
                  name="stressLevel"
                  value={value}
                  checked={questionnaire.stressLevel === value}
                  onChange={(e) => setQuestionnaire(prev => ({ ...prev, stressLevel: e.target.value }))}
                />
                <span>{value}</span>
              </label>
            ))}
          </div>

          <label style={styles.fieldLabel}>Daily caffeine intake</label>
          <div style={styles.optionGrid}>
            {[
              "None",
              "Low (1 cup coffee or less)",
              "Moderate (2-3 cups)",
              "High (4+ cups / energy drinks)"
            ].map((value) => (
              <label key={value} style={styles.optionLabel}>
                <input
                  type="radio"
                  name="caffeineIntake"
                  value={value}
                  checked={questionnaire.caffeineIntake === value}
                  onChange={(e) => setQuestionnaire(prev => ({ ...prev, caffeineIntake: e.target.value }))}
                />
                <span>{value}</span>
              </label>
            ))}
          </div>
        </div>
      )
    },
    {
      id: "diet",
      title: "Diet & sensitivities",
      body: (
        <div style={styles.fieldGroup}>
          <label style={styles.fieldLabel}>Diet preference</label>
          <div style={styles.optionGrid}>
            {["Omnivore", "Vegetarian", "Vegan", "Keto / low-carb", "Other"].map((value) => (
              <label key={value} style={styles.optionLabel}>
                <input
                  type="radio"
                  name="dietPreference"
                  value={value}
                  checked={questionnaire.dietPreference === value}
                  onChange={(e) => setQuestionnaire(prev => ({ ...prev, dietPreference: e.target.value }))}
                />
                <span>{value}</span>
              </label>
            ))}
          </div>

          <label style={styles.fieldLabel}>Are you sensitive to any of the following? (select all that apply)</label>
          <div style={styles.optionGrid}>
            {["Caffeine", "Artificial sweeteners", "Dairy", "Soy", "Shellfish", "None"].map((value) => (
              <label key={value} style={styles.optionLabel}>
                <input
                  type="checkbox"
                  checked={questionnaire.sensitivities.includes(value)}
                  onChange={() => setQuestionnaire(prev => ({
                    ...prev,
                    sensitivities: toggleMultiSelect(prev.sensitivities, value)
                  }))}
                />
                <span>{value}</span>
              </label>
            ))}
          </div>

          <label style={styles.fieldLabel}>Any known allergies?</label>
          <input
            type="text"
            value={questionnaire.allergies}
            onChange={(e) => setQuestionnaire(prev => ({ ...prev, allergies: e.target.value }))}
            placeholder="List any allergies"
            style={styles.textInput}
          />

        </div>
      )
    },
    {
      id: "safety",
      title: "Safety",
      body: (
        <div style={styles.fieldGroup}>
          {questionnaire.gender === "Female" && (
            <>
              <label style={styles.fieldLabel}>Are you currently pregnant or breastfeeding?</label>
              <div style={styles.optionGrid}>
                {["Yes", "No", "Not applicable"].map((value) => (
                  <label key={value} style={styles.optionLabel}>
                    <input
                      type="radio"
                      name="pregnantOrBreastfeeding"
                      value={value}
                      checked={questionnaire.pregnantOrBreastfeeding === value}
                      onChange={(e) => setQuestionnaire(prev => ({ ...prev, pregnantOrBreastfeeding: e.target.value }))}
                    />
                    <span>{value}</span>
                  </label>
                ))}
              </div>
            </>
          )}

          <label style={styles.fieldLabel}>Are you currently taking prescription medications?</label>
          <div style={styles.optionGrid}>
            {["Yes", "No"].map((value) => (
              <label key={value} style={styles.optionLabel}>
                <input
                  type="radio"
                  name="takingMedications"
                  value={value}
                  checked={questionnaire.takingMedications === value}
                  onChange={(e) => setQuestionnaire(prev => ({ ...prev, takingMedications: e.target.value }))}
                />
                <span>{value}</span>
              </label>
            ))}
          </div>
          <p style={styles.helperText}>
            If yes, we will avoid ingredient combinations that may not be suitable.
          </p>
        </div>
      )
    },
    {
      id: "confirm",
      title: "Disclaimer & confirmation",
      body: (
        <div style={styles.fieldGroup}>
          <label style={styles.optionLabel}>
            <input
              type="checkbox"
              checked={questionnaire.confirmDisclaimer}
              onChange={(e) => setQuestionnaire(prev => ({ ...prev, confirmDisclaimer: e.target.checked }))}
            />
            <span>I understand this product is not intended to diagnose, treat, cure, or prevent any disease.</span>
          </label>
          <label style={styles.optionLabel}>
            <input
              type="checkbox"
              checked={questionnaire.confirmAccuracy}
              onChange={(e) => setQuestionnaire(prev => ({ ...prev, confirmAccuracy: e.target.checked }))}
            />
            <span>I confirm the information provided is accurate to the best of my knowledge.</span>
          </label>
        </div>
      )
    }
  ];

  const handleQuestionnaireStart = () => {
    setShowQuestionnairePrompt(false);
    setQuestionnaireDismissed(false);
    setQuestionnaireActive(true);
    setQuestionnaireStep(0);
  };

  const handleQuestionnaireDecline = () => {
    setShowQuestionnairePrompt(false);
    setQuestionnaireDismissed(true);
    setMessages(prev => [
      ...prev,
      { role: "user", content: text.declineQuestionnaire },
      {
        role: "assistant",
        content: isChinese
          ? "å¥½çš„ï¼Œæˆ‘ä»¬å¯ä»¥ç›´æŽ¥ç»§ç»­èŠå¤©ã€‚å‘Šè¯‰æˆ‘ä½ æƒ³äº†è§£çš„å¥åº·æˆ–è¥å…»é—®é¢˜å§ã€‚"
          : "No problem, we can continue without the questionnaire. Ask me any health or nutrition question whenever you're ready."
      }
    ]);
  };

  const handleQuestionnaireNext = () => {
    if (questionnaireStep === 0 && questionnaire.eligibility18Plus === "No") {
      setQuestionnaireActive(false);
      setQuestionnaireDismissed(true);
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: text.under18Notice }
      ]);
      return;
    }

    setQuestionnaireStep((prev) => Math.min(prev + 1, questionnaireSteps.length - 1));
  };

  const handleQuestionnaireBack = () => {
    setQuestionnaireStep((prev) => Math.max(prev - 1, 0));
  };

  const summarizeQuestionnaire = () => {
    const lines = [
      `Eligibility 18+: ${questionnaire.eligibility18Plus || "Not provided"}`,
      `Age range: ${questionnaire.ageRange || "Not provided"}`,
      `Gender: ${questionnaire.gender || "Not provided"}`,
      `Height: ${questionnaire.heightRange || "Not provided"}`,
      `Weight range: ${questionnaire.weightRange || "Not provided"}`,
      `Primary goals: ${questionnaire.primaryGoals.length ? questionnaire.primaryGoals.join(", ") : "Not provided"}`,
      `Activity level: ${questionnaire.activityLevel || "Not provided"}`,
      `Exercise types: ${questionnaire.exerciseTypes.length ? questionnaire.exerciseTypes.join(", ") : "Not provided"}`,
      `Sleep duration: ${questionnaire.sleepDuration || "Not provided"}`,
      `Stress level: ${questionnaire.stressLevel || "Not provided"}`,
      `Diet preference: ${questionnaire.dietPreference || "Not provided"}`,
      `Caffeine intake: ${questionnaire.caffeineIntake || "Not provided"}`,
      `Sensitivities: ${questionnaire.sensitivities.length ? questionnaire.sensitivities.join(", ") : "Not provided"}`,
      `Allergies: ${questionnaire.allergies || "Not provided"}`,
      `Pregnant or breastfeeding: ${questionnaire.pregnantOrBreastfeeding || "Not provided"}`,
      `Taking prescription medications: ${questionnaire.takingMedications || "Not provided"}`,
      `Disclaimer confirmed: ${questionnaire.confirmDisclaimer ? "Yes" : "No"}`,
      `Accuracy confirmed: ${questionnaire.confirmAccuracy ? "Yes" : "No"}`
    ];

    return `Questionnaire responses:\n- ${lines.join("\n- ")}`;
  };

  const handleQuestionnaireFinish = async () => {
    setQuestionnaireActive(false);
    setQuestionnaireCompleted(true);
    setQuestionnaireDismissed(false);
    const summary = summarizeQuestionnaire();
    setMessages(prev => [...prev, { role: "user", content: summary }]);
    await sendMessageToAI(summary);
    setMessages(prev => [
      ...prev,
      {
        role: "assistant",
        content: text.uploadBloodworkPrompt
      }
    ]);
  };

  const handleUploadYes = () => {
    setShowUploadPrompt(false);
    if (pendingUploads.length === 0) return;
    const hasPdf = pendingUploads.some((file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));
    if (hasPdf && pendingUploads.length > 1) {
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: text.mixedFileError }
      ]);
      setPendingUploads([]);
      return;
    }
    if (hasPdf) {
      analyzeUploadedFile(pendingUploads[0]);
      return;
    }
    if (pendingUploads.length === 1) {
      analyzeUploadedFile(pendingUploads[0]);
      return;
    }
    analyzeUploadedImages(pendingUploads);
  };

  const handleUploadNo = () => {
    setShowUploadPrompt(false);
    if (pendingUploads.length === 0) return;
    const hasPdf = pendingUploads.some((file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));
    if (hasPdf) {
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: text.pdfInChatError }
      ]);
      setPendingUploads([]);
      setUploadedFile(null);
      return;
    }
    if (pendingUploads.length === 1) {
      analyzeImageInChat(pendingUploads[0]);
      return;
    }
    analyzeImagesInChat(pendingUploads);
  };

  const analyzeUploadedImages = async (files: File[]) => {
    setIsLoading(true);
    try {
      const images = await Promise.all(
        files.map(async (file) => ({
          base64: await fileToBase64(file),
          fileType: file.type || "image/jpeg"
        }))
      );
      const analysis = await analyzeBloodworkImages(images);
      persistentStorage.setItem("bloodworkAnalysis", JSON.stringify(analysis));
      persistentStorage.setItem(
        "bloodworkAnalysisMeta",
        JSON.stringify({
          uploadedAt: new Date().toISOString(),
          fileName: files.map((file) => file.name).join(", "),
          fileType: "images",
          fileSize: files.reduce((sum, file) => sum + file.size, 0)
        })
      );
      navigate("/insights");
    } catch (error) {
      console.error("Error analyzing images:", error);
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: text.imagesProcessError }
      ]);
    } finally {
      setIsLoading(false);
      setUploadedFile(null);
      setPendingUploads([]);
    }
  };

  const analyzeImagesInChat = async (files: File[]) => {
    setIsLoading(true);
    try {
      const imageParts = await Promise.all(
        files.map(async (file) => {
          const base64 = await fileToBase64(file);
          return {
            type: "image_url" as const,
            image_url: { url: `data:${file.type || "image/jpeg"};base64,${base64}` }
          };
        })
      );

      const response = await createChatCompletion({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a helpful health assistant. ${text.aiLanguageInstruction} Analyze all provided images together and provide one overall report. Include: (1) Overview of what you see, (2) Notable findings, (3) Plausible non-diagnostic possibilities, (4) Safe next steps. Be concise but complete (6-10 sentences). Avoid markdown/bold and do not end mid-sentence.`
          },
          {
            role: "user",
            content: [
              { type: "text", text: text.imagesAnalyzePrompt },
              ...imageParts
            ]
          }
        ],
        temperature: 0.3,
        max_tokens: 900
      });

      const assistantMessage: Message = {
        role: "assistant",
        content: stripDisclaimers(
          response.choices[0].message.content || text.imagesAnalyzeFallback
        )
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Error analyzing images:", error);
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: text.imagesAnalyzeError }
      ]);
    } finally {
      setIsLoading(false);
      setUploadedFile(null);
      setPendingUploads([]);
    }
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
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{text.title}</h2>
            <p style={{ margin: 0, fontSize: 13, color: theme.colors.textSecondary, marginTop: 4 }}>
              {text.subtitle}
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
          {showUploadPrompt && (
            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <div style={styles.questionnaireCard}>
                <p style={styles.questionnaireTitle}>{text.bloodReportTitle}</p>
                <p style={styles.helperText}>
                  {isChinese
                    ? `å·²é€‰æ‹© ${pendingUploads.length} ä¸ªæ–‡ä»¶ã€‚å¦‚æžœæ‰‹æœºä¸æ”¯æŒå¤šé€‰ï¼Œå¯ä»¥ç‚¹å‡»ä¸‹æ–¹æŒ‰é’®ç»§ç»­æ·»åŠ ã€‚`
                    : `${pendingUploads.length} file(s) selected. If your phone does not support multi-select, tap below to add more images one by one.`}
                </p>
                <div style={styles.questionnaireActions}>
                  <button onClick={handleAttachClick} style={styles.secondaryButton}>
                    {isChinese ? "ç»§ç»­æ·»åŠ å›¾ç‰‡" : "Add more images"}
                  </button>
                  <button onClick={handleUploadYes} style={styles.primaryButton}>{text.yesAnalyze}</button>
                  <button onClick={handleUploadNo} style={styles.secondaryButton}>{text.noNotBlood}</button>
                </div>
              </div>
            </div>
          )}
          {showQuestionnairePrompt && !questionnaireActive && (
            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <div style={styles.questionnaireCard}>
                <p style={styles.questionnaireTitle}>{text.questionnaireTitle}</p>
                <div style={styles.questionnaireActions}>
                  <button onClick={handleQuestionnaireStart} style={styles.primaryButton}>{text.yes}</button>
                  <button onClick={handleQuestionnaireDecline} style={styles.secondaryButton}>{text.no}</button>
                </div>
              </div>
            </div>
          )}
          {questionnaireActive && (
            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <div style={styles.questionnaireCard}>
                <p style={styles.questionnaireTitle}>{questionnaireSteps[questionnaireStep].title}</p>
                {questionnaireSteps[questionnaireStep].body}
                <div style={styles.questionnaireActions}>
                  <button
                    onClick={handleQuestionnaireBack}
                    style={styles.secondaryButton}
                    disabled={questionnaireStep === 0}
                  >
                    {text.back}
                  </button>
                  {questionnaireStep < questionnaireSteps.length - 1 ? (
                    <button onClick={handleQuestionnaireNext} style={styles.primaryButton}>
                      {text.next}
                    </button>
                  ) : (
                    <button onClick={handleQuestionnaireFinish} style={styles.primaryButton}>
                      {text.finish}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
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
                {text.thinking}
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
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              multiple
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
              title={text.attachTitle}
            >
              📎
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={text.inputPlaceholder}
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
              {text.send}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  questionnaireCard: {
    maxWidth: 520,
    background: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    border: "1px solid #E5E7EB",
    display: "grid",
    gap: 16
  },
  questionnaireTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 700,
    color: "#111827"
  },
  questionnaireActions: {
    display: "flex",
    gap: 8
  },
  primaryButton: {
    padding: "8px 14px",
    borderRadius: 10,
    border: "none",
    background: "#C58A4A",
    color: "#FFFFFF",
    fontWeight: 600,
    cursor: "pointer"
  },
  secondaryButton: {
    padding: "8px 14px",
    borderRadius: 10,
    border: "1px solid #E5E7EB",
    background: "#FFFDF9",
    color: "#1F140D",
    fontWeight: 600,
    cursor: "pointer"
  },
  fieldGroup: {
    display: "grid",
    gap: 12
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: "#1F140D"
  },
  optionGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    gap: 10
  },
  optionRow: {
    display: "flex",
    gap: 12
  },
  optionLabel: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
    color: "#1F140D"
  },
  textInput: {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid #E5E7EB",
    fontSize: 13,
    fontFamily: "inherit"
  },
  helperText: {
    margin: 0,
    fontSize: 12,
    color: "#6B7280"
  }
} as const;

export default AIChat;
