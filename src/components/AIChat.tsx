import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../theme";
import { AVAILABLE_SUPPLEMENTS } from "../data/supplements";
import OpenAI from "openai";
import { analyzeBloodworkFile, analyzeBloodworkPdf, analyzeBloodworkImages } from "../services/openai";

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
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hello! I'm your AI Health Advisor, trained on hundreds of thousands of medical journals. How can I help you with your health questions today?\n\nYou can ask me anything about health, nutrition, supplements, or upload your bloodwork for personalized analysis!"
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



  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    setUploadedFile(files[0]);
    setPendingUploads(files);
    const fileNames = files.map((file) => file.name).join(", ");
    const fileMessage: Message = {
      role: "user",
      content: `📎 Uploaded ${files.length} file(s): ${fileNames}`
    };
    setMessages(prev => [...prev, fileMessage]);

    setMessages(prev => [
      ...prev,
      { role: "assistant", content: "Is this a blood report you want analyzed?" }
    ]);
    setShowUploadPrompt(true);
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

  const analyzeImageInChat = async (file: File) => {
    setIsLoading(true);

    try {
      const base64 = await fileToBase64(file);
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a helpful health assistant. Describe visible details precisely, mention plausible non-diagnostic possibilities, and suggest safe next steps. Be concise but complete (4-7 sentences). Avoid markdown/bold and do not end mid-sentence."
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Analyze this image and explain what it shows in plain language." },
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
          response.choices[0].message.content || "I couldn't analyze that image. Please try another one."
        )
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Error analyzing image:", error);
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: "I ran into an error analyzing that image. Please try again." }
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

      localStorage.setItem("bloodworkAnalysis", JSON.stringify(analysis));
      localStorage.setItem(
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
        content: "I encountered an error processing your file. Please try again or describe your bloodwork results to me."
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

If users mention bloodwork values or health concerns, provide specific advice. Be friendly, clear, and helpful.

If you need more context before giving tailored guidance, ask: "Would you like to answer a short questionnaire to personalize this further?"

If you recommend supplements, ONLY use items from this list: ${supplementsList}.
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
        response.choices[0].message.content || "I apologize, I couldn't generate a response. Please try again."
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
        content: `I'm sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please check your OpenAI API key.`
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

    const isGreeting = /^(hi|hello|hey|good morning|good afternoon|good evening)\b/i.test(currentInput.trim());
    if (isGreeting && !questionnaireCompleted && !questionnaireActive) {
      const promptMessage: Message = {
        role: "assistant",
        content: "Would you like to answer a short questionnaire to personalize your guidance?"
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
    setQuestionnaireActive(true);
    setQuestionnaireStep(0);
  };

  const handleQuestionnaireDecline = () => {
    setShowQuestionnairePrompt(false);
    setMessages(prev => [
      ...prev,
      { role: "user", content: "No thanks, continue without the questionnaire." }
    ]);
  };

  const handleQuestionnaireNext = () => {
    if (questionnaireStep === 0 && questionnaire.eligibility18Plus === "No") {
      setQuestionnaireActive(false);
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: "Thanks for letting me know. This questionnaire is only for users 18+. Feel free to ask any other questions." }
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
    const summary = summarizeQuestionnaire();
    setMessages(prev => [...prev, { role: "user", content: summary }]);
    await sendMessageToAI(summary);
    setMessages(prev => [
      ...prev,
      {
        role: "assistant",
        content: "Would you like to upload your bloodwork for more accurate recommendations and a detailed reading?"
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
        { role: "assistant", content: "Please upload either a single PDF or multiple images, not a mix of files." }
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
        { role: "assistant", content: "I can analyze images here, but PDFs need the blood report analyzer. Please upload a clear image instead." }
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
      localStorage.setItem("bloodworkAnalysis", JSON.stringify(analysis));
      localStorage.setItem(
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
        { role: "assistant", content: "I encountered an error processing those images. Please try again." }
      ]);
    } finally {
      setIsLoading(false);
      setUploadedFile(null);
      setPendingUploads([]);
    }
  };

  const analyzeImagesInChat = async (files: File[]) => {
    for (const file of files) {
      // eslint-disable-next-line no-await-in-loop
      await analyzeImageInChat(file);
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
          {showUploadPrompt && (
            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <div style={styles.questionnaireCard}>
                <p style={styles.questionnaireTitle}>Is this a blood report?</p>
                <div style={styles.questionnaireActions}>
                  <button onClick={handleUploadYes} style={styles.primaryButton}>Yes, analyze</button>
                  <button onClick={handleUploadNo} style={styles.secondaryButton}>No, it's not</button>
                </div>
              </div>
            </div>
          )}
          {showQuestionnairePrompt && !questionnaireActive && (
            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <div style={styles.questionnaireCard}>
                <p style={styles.questionnaireTitle}>Quick questionnaire?</p>
                <div style={styles.questionnaireActions}>
                  <button onClick={handleQuestionnaireStart} style={styles.primaryButton}>Yes</button>
                  <button onClick={handleQuestionnaireDecline} style={styles.secondaryButton}>No</button>
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
                    Back
                  </button>
                  {questionnaireStep < questionnaireSteps.length - 1 ? (
                    <button onClick={handleQuestionnaireNext} style={styles.primaryButton}>
                      Next
                    </button>
                  ) : (
                    <button onClick={handleQuestionnaireFinish} style={styles.primaryButton}>
                      Finish
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
