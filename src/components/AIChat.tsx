import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../i18n";
import { useTheme } from "../theme";
import { AVAILABLE_SUPPLEMENTS } from "../data/supplements";
import { CHAT_RECOMMENDATION_CATEGORIES } from "../data/chatRecommendationProfiles";
import {
  analyzeBloodworkFile,
  analyzeBloodworkPdf,
  analyzeBloodworkImages,
  generateChatSupplementRecommendations,
  generateSupplementRecommendationsFromContext,
  localizeAssistantText,
  type BloodworkAnalysis,
  type SupplementRecommendation
} from "../services/openai";
import { persistentStorage } from "../services/persistentStorage";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface RecommendationCardState {
  summary: string;
  recommendations: SupplementRecommendation[];
}

interface RecommendationExample {
  timestamp: string;
  language: "en" | "zh";
  userMessage: string;
  assistantReply: string;
  hadRecommendations: boolean;
  recommendedSupplementIds: string[];
}

interface AIChatProps {
  onClose: () => void;
}

const repairMojibake = (value: string) => {
  if (!/[ÃÅÆÐÑØÞßà-ÿ]/.test(value)) return value;
  try {
    const bytes = Uint8Array.from(value.split("").map((char) => char.charCodeAt(0) & 0xff));
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  } catch {
    return value;
  }
};

const normalizeLocalizedObject = <T extends Record<string, unknown>>(input: T): T =>
  Object.fromEntries(
    Object.entries(input).map(([key, value]) => {
      if (typeof value === "string") {
        return [key, repairMojibake(value)];
      }
      if (typeof value === "function") {
        return [
          key,
          (...args: unknown[]) => {
            const result = value(...args);
            return typeof result === "string" ? repairMojibake(result) : result;
          }
        ];
      }
      return [key, value];
    })
  ) as T;

const getSupplementById = (id: string) => AVAILABLE_SUPPLEMENTS.find((supplement) => supplement.id === id);
const CHAT_RECOMMENDATION_EXAMPLES_KEY = "chatRecommendationExamples";

const URGENT_SYMPTOM_PATTERNS = [
  /\b(chest pain|shortness of breath|difficulty breathing|fainting|severe bleeding|blood in stool|vomiting blood|stroke|seizure|severe abdominal pain|high fever|suicidal|passed out|loss of consciousness|black stool|tarry stool|coughing blood|severe dehydration|one-sided weakness|confusion|sudden vision loss|blood in urine|unable to urinate|severe flank pain|severe sore throat|trouble swallowing)\b/i,
  /胸痛|呼吸困难|晕倒|大量出血|便血|吐血|中风|癫痫|剧烈腹痛|高烧|失去意识|黑便|咳血|严重脱水|单侧无力|意识混乱|突然失明|尿血|无法排尿|剧烈腰侧痛|严重喉咙痛|吞咽困难/
];

const CATEGORY_EXCLUSIONS: Array<{
  patterns: RegExp[];
  removeCategories?: string[];
  removeSupplements?: string[];
}> = [
  {
    patterns: [/\b(diarrhea|diarrhoea|loose stool|watery stool|vomiting|stomach flu)\b/i, /腹泻|拉肚子|水样便|呕吐/],
    removeCategories: ["digestive-constipation"],
    removeSupplements: ["organic-psyllium-husk", "chia-seed", "australian-instant-oats", "baobab-powder"]
  },
  {
    patterns: [/\b(anxiety|anxious|panic|palpitations|racing heart|jitters)\b/i, /焦虑|惊恐|心悸|心跳快/],
    removeSupplements: ["matcha-powder"]
  },
  {
    patterns: [/\b(insomnia|can't sleep|cannot sleep|trouble sleeping|poor sleep|sleep problem)\b/i, /失眠|睡不着|睡眠差/],
    removeSupplements: ["matcha-powder", "beetroot-powder"]
  },
  {
    patterns: [/\b(acid reflux|heartburn|gerd)\b/i, /反酸|烧心/],
    removeSupplements: ["chia-seed", "organic-psyllium-husk"]
  },
  {
    patterns: [/\b(urinary discomfort|pee pain|burning pee|frequent urination|urine discomfort|bladder discomfort)\b/i, /尿痛|尿频|尿路不适|膀胱不适/],
    removeSupplements: ["matcha-powder", "beetroot-powder"]
  }
];

const normalizeSymptomText = (value: string) =>
  value
    .toLowerCase()
    .replace(/stomache/g, "stomach")
    .replace(/migrane/g, "migraine")
    .replace(/hedache/g, "headache")
    .replace(/vomitting/g, "vomiting")
    .replace(/diahrea/g, "diarrhea")
    .replace(/constipated badly/g, "constipation")
    .replace(/bloaty/g, "bloating")
    .replace(/tummy pain/g, "stomach pain")
    .replace(/tummy not good/g, "upset stomach")
    .replace(/stomach not good/g, "upset stomach")
    .replace(/feel like vomit/g, "nausea")
    .replace(/feel wana vomit/g, "nausea")
    .replace(/wanna vomit/g, "nausea")
    .replace(/wana vomit/g, "nausea")
    .replace(/feel like throwing up/g, "nausea")
    .replace(/throwing up/g, "vomiting")
    .replace(/hard stool/g, "hard stool")
    .replace(/not fully out/g, "incomplete bowel movement")
    .replace(/still feel need to poop/g, "incomplete bowel movement")
    .replace(/cannot empty bowel/g, "incomplete bowel movement")
    .replace(/constipated when travel/g, "travel constipation")
    .replace(/bloated after eating/g, "bloating after meals")
    .replace(/bloated after meals/g, "bloating after meals")
    .replace(/after certain food/g, "food triggered")
    .replace(/certain food make me bloat/g, "food triggered")
    .replace(/lots of gas/g, "gas heavy")
    .replace(/a lot of gas/g, "gas heavy")
    .replace(/cant poop/g, "constipation")
    .replace(/cannot poop/g, "constipation")
    .replace(/hard to poop/g, "constipation")
    .replace(/cannot shit/g, "constipation")
    .replace(/pain on knee/g, "knee pain")
    .replace(/pain knee/g, "knee pain")
    .replace(/pain at knee/g, "knee pain")
    .replace(/pain on back/g, "back pain")
    .replace(/pain at back/g, "back pain")
    .replace(/head very pain/g, "headache")
    .replace(/my head pain/g, "headache")
    .replace(/head pain/g, "headache")
    .replace(/no energy/g, "low energy")
    .replace(/always no energy/g, "low energy")
    .replace(/very tired/g, "fatigue")
    .replace(/body very weak/g, "weakness")
    .replace(/i feel weak/g, "weakness")
    .replace(/whole body weak/g, "weakness")
    .replace(/super tired/g, "fatigue")
    .replace(/hands and legs cold/g, "cold hands cold feet")
    .replace(/always sick/g, "keep getting sick")
    .replace(/keep fall sick/g, "keep getting sick")
    .replace(/fall sick easily/g, "keep getting sick")
    .replace(/cant sleep well/g, "poor sleep")
    .replace(/sleep not good/g, "poor sleep")
    .replace(/cannot sleep well/g, "poor sleep")
    .replace(/sleep keep wake up/g, "waking often")
    .replace(/period very pain/g, "period pain")
    .replace(/mens pain/g, "period pain")
    .replace(/moody before period/g, "pms mood")
    .replace(/tired during period/g, "period fatigue")
    .replace(/night sweat cant sleep/g, "perimenopause sleep")
    .replace(/itchy nose/g, "allergy")
    .replace(/blocked nose/g, "stuffy nose")
    .replace(/nose block/g, "stuffy nose")
    .replace(/keep sneezing/g, "sneezing")
    .replace(/nose keep running/g, "runny nose")
    .replace(/mucus drip to throat/g, "post nasal drip")
    .replace(/post nasal drip/g, "post nasal drip")
    .replace(/nose keep running/g, "runny nose")
    .replace(/mucus drip to throat/g, "post nasal drip")
    .replace(/post nasal drip/g, "post nasal drip")
    .replace(/throat pain/g, "sore throat")
    .replace(/my throat hurt/g, "sore throat")
    .replace(/dry throat/g, "sore throat")
    .replace(/itchy throat/g, "sore throat")
    .replace(/dry cough/g, "dry cough")
    .replace(/cough with phlegm/g, "phlegmy cough")
    .replace(/cough with mucus/g, "phlegmy cough")
    .replace(/wet cough/g, "phlegmy cough")
    .replace(/dry cough/g, "dry cough")
    .replace(/cough with phlegm/g, "phlegmy cough")
    .replace(/cough with mucus/g, "phlegmy cough")
    .replace(/wet cough/g, "phlegmy cough")
    .replace(/eye tired/g, "eye strain")
    .replace(/eyes tired/g, "eye strain")
    .replace(/eyes blur after screen/g, "screen fatigue")
    .replace(/screen too long/g, "screen fatigue")
    .replace(/mouse hand/g, "mouse hand")
    .replace(/wrist pain from mouse/g, "wrist strain")
    .replace(/neck from laptop/g, "laptop neck")
    .replace(/headache from screen/g, "screen headache")
    .replace(/mouse hand/g, "mouse hand")
    .replace(/wrist pain from mouse/g, "wrist strain")
    .replace(/neck from laptop/g, "laptop neck")
    .replace(/headache from screen/g, "screen headache")
    .replace(/mouth sore/g, "mouth ulcer")
    .replace(/gum pain/g, "gum sensitivity")
    .replace(/pee pain/g, "urinary discomfort")
    .replace(/burning pee/g, "urinary discomfort")
    .replace(/burning when pee/g, "urinary discomfort")
    .replace(/no appetite/g, "appetite loss")
    .replace(/cannot eat much/g, "appetite loss")
    .replace(/after sick/g, "post illness")
    .replace(/recover from flu/g, "post illness")
    .replace(/after antibiotics/g, "after antibiotics")
    .replace(/not eating much lately/g, "after poor appetite")
    .replace(/after antibiotics/g, "after antibiotics")
    .replace(/not eating much lately/g, "after poor appetite")
    .replace(/itchy skin/g, "dry skin")
    .replace(/skin very dry/g, "dry skin")
    .replace(/hot flush/g, "hot flashes")
    .replace(/body suddenly hot/g, "hot flashes")
    .replace(/sit too long/g, "office stiffness")
    .replace(/sitting all day/g, "office stiffness")
    .replace(/desk job pain/g, "office stiffness")
    .replace(/office body stiff/g, "office stiffness")
    .replace(/sit too much/g, "sedentary")
    .replace(/shoulder and neck pain/g, "shoulder pain neck pain")
    .replace(/neck and shoulder pain/g, "neck pain shoulder pain")
    .replace(/stomach pains/g, "stomach pain")
    .replace(/back aches/g, "back ache")
    .replace(/backaches/g, "backache")
    .replace(/body aches/g, "body ache")
    .replace(/hard stool/g, "hard stool")
    .replace(/not fully out/g, "incomplete bowel movement")
    .replace(/still feel need to poop/g, "incomplete bowel movement")
    .replace(/cannot empty bowel/g, "incomplete bowel movement")
    .replace(/constipated when travel/g, "travel constipation")
    .replace(/bloated after eating/g, "bloating after meals")
    .replace(/bloated after meals/g, "bloating after meals")
    .replace(/after certain food/g, "food triggered")
    .replace(/certain food make me bloat/g, "food triggered")
    .replace(/lots of gas/g, "gas heavy")
    .replace(/a lot of gas/g, "gas heavy")
    .replace(/joint aches/g, "joint pain")
    .replace(/knee pains/g, "knee pain")
    .replace(/knees pain/g, "knee pain")
    .replace(/pain on my knees/g, "knee pain")
    .replace(/pain in my knees/g, "knee pain")
    .replace(/constant pain on my knees/g, "knee pain")
    .replace(/pain on my knee/g, "knee pain")
    .replace(/aching knees/g, "knee pain")
    .replace(/sore knees/g, "knee pain")
    .replace(/lower backache/g, "lower back pain")
    .replace(/upper backache/g, "upper back pain")
    .replace(/cold hands and feet/g, "cold hands cold feet")
    .replace(/cold hands or feet/g, "cold hands cold feet")
    .replace(/frequent colds/g, "keep getting sick")
    .replace(/getting sick often/g, "keep getting sick")
    .replace(/poor concentration/g, "focus")
    .replace(/cant focus/g, "focus")
    .replace(/can't focus/g, "focus")
    .replace(/trouble concentrating/g, "focus")
    .replace(/hair fall/g, "hair loss")
    .replace(/brittle nail/g, "brittle nails")
    .replace(/period cramps/g, "period pain")
    .replace(/menstrual pain/g, "period pain")
    .replace(/moody before period/g, "pms mood")
    .replace(/tired during period/g, "period fatigue")
    .replace(/night sweat cant sleep/g, "perimenopause sleep")
    .replace(/always hungry/g, "always hungry")
    .replace(/brainfog/g, "brain fog")
    .replace(/migraines/g, "migraine")
    .replace(/head aches/g, "headache")
    .replace(/back of my head/g, "pain at the back of my head")
    .replace(/back of head/g, "pain at the back of my head")
    .replace(/rear of my head/g, "pain at the back of my head")
    .replace(/tension in my head/g, "tension headache")
    .replace(/胃痛/g, " stomach pain ")
    .replace(/肚子痛/g, " stomach pain ")
    .replace(/腹痛/g, " stomach pain ")
    .replace(/胃胀/g, " bloating ")
    .replace(/消化不良/g, " indigestion ")
    .replace(/恶心/g, " nausea ")
    .replace(/反酸/g, " acid reflux ")
    .replace(/颈痛/g, " neck pain ")
    .replace(/肩痛/g, " shoulder pain ")
    .replace(/背痛/g, " back pain ")
    .replace(/关节痛/g, " joint pain ")
    .replace(/肌肉痛/g, " muscle pain ")
    .replace(/发炎/g, " inflammation ")
    .replace(/肿胀/g, " swelling ")
    .replace(/便秘/g, " constipation ")
    .replace(/肠胃/g, " gut ")
    .replace(/疲劳/g, " fatigue ")
    .replace(/没精神/g, " low energy ")
    .replace(/低能量/g, " low energy ")
    .replace(/脑雾/g, " brain fog ")
    .replace(/血糖/g, " blood sugar ")
    .replace(/免疫力/g, " immunity ")
    .replace(/感冒/g, " cold ")
    .replace(/皮肤/g, " skin ")
    .replace(/心脏/g, " heart health ")
    .replace(/记忆力/g, " memory ")
    .replace(/专注/g, " focus ")
    .replace(/头痛/g, " headache ")
    .replace(/偏头痛/g, " migraine ")
    .replace(/后脑勺痛/g, " pain at the back of my head ")
    .replace(/后脑痛/g, " pain at the back of my head ")
    .replace(/紧张性头痛/g, " tension headache ")
    .replace(/压力大/g, " stress ")
    .replace(/膝盖痛/g, " knee pain ")
    .replace(/膝盖酸痛/g, " knee pain ")
    .replace(/背痛/g, " back pain ")
    .replace(/腰痛/g, " lower back pain ")
    .replace(/上背痛/g, " upper back pain ")
    .replace(/下背痛/g, " lower back pain ")
    .replace(/手脚冰冷/g, " cold hands cold feet ")
    .replace(/经常感冒/g, " keep getting sick ")
    .replace(/脱发/g, " hair loss ")
    .replace(/指甲脆弱/g, " brittle nails ")
    .replace(/经痛/g, " period pain ")
    .replace(/经前综合征/g, " pms ")
    .replace(/容易饿/g, " always hungry ")
    .replace(/喉咙痒/g, " sore throat ")
    .replace(/想吐/g, " nausea ")
    .replace(/吐了/g, " vomiting ")
    .replace(/没力/g, " weakness ")
    .replace(/很累/g, " fatigue ")
    .replace(/容易生病/g, " keep getting sick ")
    .replace(/睡不好/g, " poor sleep ")
    .replace(/一直醒/g, " waking often ")
    .replace(/眼睛酸/g, " eye strain ")
    .replace(/看屏幕太久/g, " screen fatigue ")
    .replace(/喉咙干/g, " sore throat ")
    .replace(/口腔痛/g, " mouth ulcer ")
    .replace(/没胃口吃饭/g, " appetite loss ")
    .replace(/上火/g, " mouth ulcer ")
    .replace(/过敏/g, " allergy ")
    .replace(/鼻窦/g, " sinus ")
    .replace(/打喷嚏/g, " sneezing ")
    .replace(/咳嗽/g, " cough ")
    .replace(/喉咙痛/g, " sore throat ")
    .replace(/眼睛疲劳/g, " eye strain ")
    .replace(/屏幕疲劳/g, " screen fatigue ")
    .replace(/口腔溃疡/g, " mouth ulcer ")
    .replace(/牙龈敏感/g, " gum sensitivity ")
    .replace(/尿痛/g, " urinary discomfort ")
    .replace(/尿频/g, " frequent urination ")
    .replace(/没胃口/g, " appetite loss ")
    .replace(/病后恢复/g, " post illness ")
    .replace(/皮肤干燥/g, " dry skin ")
    .replace(/湿疹/g, " eczema ")
    .replace(/更年期/g, " menopause ")
    .replace(/潮热/g, " hot flashes ")
    .replace(/久坐/g, " sedentary ")
    .replace(/办公室酸痛/g, " office stiffness ")
    .replace(/\s+/g, " ")
    .trim();

const persistRecommendationExample = (
  language: "en" | "zh",
  userMessage: string,
  assistantReply: string,
  recommendations: RecommendationCardState | null
) => {
  const existing = persistentStorage.getJSON<RecommendationExample[]>(CHAT_RECOMMENDATION_EXAMPLES_KEY, []);
  const nextEntry: RecommendationExample = {
    timestamp: new Date().toISOString(),
    language,
    userMessage,
    assistantReply,
    hadRecommendations: Boolean(recommendations?.recommendations?.length),
    recommendedSupplementIds: recommendations?.recommendations?.map((item) => item.supplementId) || []
  };
  persistentStorage.setJSON(CHAT_RECOMMENDATION_EXAMPLES_KEY, [nextEntry, ...existing].slice(0, 200));
};

const buildSymptomRecommendations = (
  content: string,
  isChinese: boolean
): RecommendationCardState | null => {
  const normalizedContent = normalizeSymptomText(content);

  if (URGENT_SYMPTOM_PATTERNS.some((pattern) => pattern.test(content))) {
    return null;
  }

  const excludedCategoryIds = new Set<string>();
  const excludedSupplementIds = new Set<string>();

  CATEGORY_EXCLUSIONS.forEach((rule) => {
    if (!rule.patterns.some((pattern) => pattern.test(content))) return;
    rule.removeCategories?.forEach((categoryId) => excludedCategoryIds.add(categoryId));
    rule.removeSupplements?.forEach((supplementId) => excludedSupplementIds.add(supplementId));
  });

  const matchedCategories = CHAT_RECOMMENDATION_CATEGORIES.map((category) => {
    if (excludedCategoryIds.has(category.id)) {
      return { category, score: 0, matchedTriggers: [] as string[] };
    }
    const matchedTriggers = category.triggers.filter((trigger) => normalizedContent.includes(trigger));
    return { category, score: matchedTriggers.length, matchedTriggers };
  })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return right.category.recommendations.length - left.category.recommendations.length;
    });

  const recommendationMap = new Map<
    string,
    SupplementRecommendation & { score: number; categoryLabels: string[] }
  >();

  matchedCategories.slice(0, 2).forEach(({ category, score }) => {
    category.recommendations.forEach((item) => {
      if (excludedSupplementIds.has(item.supplementId)) return;
      const supplement = getSupplementById(item.supplementId);
      if (!supplement) return;

      const existing = recommendationMap.get(item.supplementId);
      const priorityWeight = { high: 3, medium: 2, low: 1 };

      if (!existing) {
        recommendationMap.set(item.supplementId, {
          supplementId: supplement.id,
          supplementName: supplement.name,
          reason: item.reason,
          priority: item.priority,
          dosage: item.dosage,
          score: score * 10 + priorityWeight[item.priority],
          categoryLabels: [category.label]
        });
        return;
      }

      existing.score += score * 10 + priorityWeight[item.priority];
      existing.categoryLabels = Array.from(new Set([...existing.categoryLabels, category.label]));
      if (priorityWeight[item.priority] > priorityWeight[existing.priority]) {
        existing.priority = item.priority;
        existing.reason = item.reason;
        existing.dosage = item.dosage;
      }
    });
  });

  const recommendations = Array.from(recommendationMap.values())
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .map(({ score: _score, categoryLabels, ...recommendation }) => ({
      ...recommendation,
      reason: isChinese
        ? "根据你提到的症状，可能适合作为日常支持。"
        : `${recommendation.reason} Relevant for: ${categoryLabels.slice(0, 2).join(" and ")}.`
    }));

  if (recommendations.length === 0) return null;

  return {
    summary: isChinese
      ? "我根据你提到的症状整理了可查看的产品建议。"
      : "I matched products from your catalog based on the exact symptom type you described.",
    recommendations
  };
};

const persistChatRecommendations = (card: RecommendationCardState, userInput: string) => {
  const analysis: BloodworkAnalysis = {
    summary: card.summary,
    concerns: [userInput],
    strengths: [],
    recommendations: card.recommendations,
    detailedInsights: [
      {
        category: "AI chat symptom matching",
        findings: userInput,
        impact: card.summary
      }
    ]
  };

  persistentStorage.setItem("bloodworkAnalysis", JSON.stringify(analysis));
  persistentStorage.setItem(
    "bloodworkAnalysisMeta",
    JSON.stringify({
      uploadedAt: new Date().toISOString(),
      fileName: "AI chat symptom recommendation",
      fileType: "chat-symptom-match",
      fileSize: userInput.length
    })
  );
};

const AIChat: React.FC<AIChatProps> = ({ onClose }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { language } = useI18n();
  const isChinese = language === "zh";
  const rawText = {
    welcome: isChinese
      ? "\u4f60\u597d\uff0c\u6211\u662f\u4f60\u7684 AI \u5065\u5eb7\u987e\u95ee\uff0c\u57fa\u4e8e\u5927\u91cf\u533b\u5b66\u671f\u520a\u5185\u5bb9\u8fdb\u884c\u8bad\u7ec3\u3002\u4eca\u5929\u60f3\u54a8\u8be2\u4ec0\u4e48\u5065\u5eb7\u95ee\u9898\uff1f\n\n\u4f60\u53ef\u4ee5\u95ee\u6211\u5065\u5eb7\u3001\u8425\u517b\u76f8\u5173\u7684\u95ee\u9898\uff0c\u6216\u4e0a\u4f20\u8840\u6db2\u62a5\u544a\u83b7\u5f97\u4e2a\u6027\u5316\u5206\u6790\u3002"
      : "Hello! I'm your AI Health Advisor, trained on hundreds of thousands of medical journals. How can I help you with your health questions today?\n\nYou can ask me anything about health, nutrition, or upload your bloodwork for personalized analysis!",
    uploadedFiles: (count: number, names: string) =>
      isChinese ? `\u5df2\u4e0a\u4f20 ${count} \u4e2a\u6587\u4ef6\uff1a${names}` : `Uploaded ${count} file(s): ${names}`,
    uploadPrompt: isChinese ? "\u8fd9\u662f\u4f60\u60f3\u5206\u6790\u7684\u8840\u6db2\u62a5\u544a\u5417\uff1f" : "Is this a blood report you want analyzed?",
    personalizePrompt: isChinese
      ? "\u4f60\u613f\u610f\u5148\u56de\u7b54\u4e00\u4e2a\u7b80\u77ed\u95ee\u5377\uff0c\u8ba9\u5efa\u8bae\u66f4\u4e2a\u6027\u5316\u5417\uff1f"
      : "Would you like to answer a short questionnaire to personalize your guidance?",
    uploadBloodworkPrompt: isChinese
      ? "\u4f60\u60f3\u4e0a\u4f20\u8840\u6db2\u62a5\u544a\uff0c\u4ee5\u83b7\u5f97\u66f4\u51c6\u786e\u7684\u5efa\u8bae\u548c\u66f4\u8be6\u7ec6\u7684\u89e3\u8bfb\u5417\uff1f"
      : "Would you like to upload your bloodwork for more accurate recommendations and a detailed reading?",
    declineQuestionnaire: isChinese ? "\u4e0d\u7528\u4e86\uff0c\u7ee7\u7eed\u804a\u5929\u5373\u53ef\u3002" : "No thanks, continue without the questionnaire.",
    under18Notice: isChinese
      ? "\u611f\u8c22\u544a\u77e5\u3002\u672c\u95ee\u5377\u4ec5\u9002\u7528\u4e8e 18 \u5c81\u53ca\u4ee5\u4e0a\u7528\u6237\u3002\u4f60\u4ecd\u7136\u53ef\u4ee5\u7ee7\u7eed\u54a8\u8be2\u5176\u4ed6\u5065\u5eb7\u95ee\u9898\u3002"
      : "Thanks for letting me know. This questionnaire is only for users 18+. Feel free to ask any other questions.",
    fileProcessError: isChinese
      ? "\u5904\u7406\u4f60\u7684\u6587\u4ef6\u65f6\u51fa\u73b0\u9519\u8bef\u3002\u8bf7\u91cd\u8bd5\uff0c\u6216\u76f4\u63a5\u544a\u8bc9\u6211\u4f60\u7684\u8840\u6db2\u68c0\u6d4b\u7ed3\u679c\u3002"
      : "I encountered an error processing your file. Please try again or describe your bloodwork results to me.",
    mixedFileError: isChinese
      ? "\u8bf7\u4e0a\u4f20\u5355\u4e2a PDF\uff0c\u6216\u4e0a\u4f20\u591a\u5f20\u56fe\u7247\uff0c\u4e0d\u8981\u6df7\u5408\u4e0a\u4f20\u3002"
      : "Please upload either a single PDF or multiple images, not a mix of files.",
    pdfInChatError: isChinese
      ? "\u8fd9\u91cc\u53ef\u4ee5\u5206\u6790\u56fe\u7247\uff0c\u4f46 PDF \u9700\u8981\u4f7f\u7528\u8840\u6db2\u62a5\u544a\u5206\u6790\u5668\u3002\u8bf7\u6539\u4e3a\u4e0a\u4f20\u6e05\u6670\u56fe\u7247\u3002"
      : "I can analyze images here, but PDFs need the blood report analyzer. Please upload a clear image instead.",
    imageAnalyzePrompt: isChinese
      ? "\u8bf7\u5206\u6790\u8fd9\u5f20\u56fe\u7247\uff0c\u5e76\u7528\u901a\u4fd7\u6613\u61c2\u7684\u8bed\u8a00\u8bf4\u660e\u4f60\u770b\u5230\u7684\u5185\u5bb9\u3002"
      : "Analyze this image and explain what it shows in plain language.",
    imageAnalyzeFallback: isChinese ? "\u6211\u6682\u65f6\u65e0\u6cd5\u5206\u6790\u8fd9\u5f20\u56fe\u7247\u3002\u8bf7\u6362\u4e00\u5f20\u518d\u8bd5\u3002" : "I couldn't analyze that image. Please try another one.",
    imageAnalyzeError: isChinese ? "\u5206\u6790\u8fd9\u5f20\u56fe\u7247\u65f6\u51fa\u73b0\u9519\u8bef\uff0c\u8bf7\u518d\u8bd5\u4e00\u6b21\u3002" : "I ran into an error analyzing that image. Please try again.",
    imagesAnalyzePrompt: isChinese
      ? "\u8bf7\u7efc\u5408\u5206\u6790\u6240\u6709\u56fe\u7247\uff0c\u5e76\u7528\u901a\u4fd7\u6613\u61c2\u7684\u8bed\u8a00\u7ed9\u51fa\u4e00\u4efd\u6574\u4f53\u8bf4\u660e\u3002"
      : "Analyze all images together and provide one overall report in plain language.",
    imagesAnalyzeFallback: isChinese ? "\u6211\u6682\u65f6\u65e0\u6cd5\u5206\u6790\u8fd9\u4e9b\u56fe\u7247\u3002\u8bf7\u6362\u4e00\u7ec4\u518d\u8bd5\u3002" : "I couldn't analyze those images. Please try another set.",
    imagesAnalyzeError: isChinese ? "\u5206\u6790\u8fd9\u4e9b\u56fe\u7247\u65f6\u51fa\u73b0\u9519\u8bef\uff0c\u8bf7\u518d\u8bd5\u4e00\u6b21\u3002" : "I ran into an error analyzing those images. Please try again.",
    imagesProcessError: isChinese ? "\u5904\u7406\u8fd9\u4e9b\u56fe\u7247\u65f6\u51fa\u73b0\u9519\u8bef\uff0c\u8bf7\u518d\u8bd5\u4e00\u6b21\u3002" : "I encountered an error processing those images. Please try again.",
    supplementPromptTitle: isChinese ? "\u9700\u8981\u8425\u517b\u5efa\u8bae\u5417\uff1f" : "Need supplement suggestions?",
    supplementPromptBody: isChinese
      ? "\u6839\u636e\u521a\u624d\u7684\u56fe\u7247\u5206\u6790\uff0c\u6211\u53ef\u4ee5\u63a8\u8350\u53ef\u80fd\u9002\u5408\u7684\u8425\u517b\u8865\u5145\u4ea7\u54c1\u3002"
      : "Based on the image issue I just analyzed, I can suggest suitable supplements for support.",
    supplementPromptYes: isChinese ? "\u67e5\u770b\u5efa\u8bae" : "View suggestions",
    supplementPromptNo: isChinese ? "\u6682\u65f6\u4e0d\u7528" : "Not now",
    chatRecommendationTitle: isChinese ? "\u4ea7\u54c1\u5efa\u8bae" : "Product recommendations",
    chatRecommendationButton: isChinese ? "\u67e5\u770b\u5efa\u8bae" : "View recommendations",
    chatRecommendationDisclaimer: isChinese
      ? "\u5982\u679c\u75c7\u72b6\u6301\u7eed\u6216\u52a0\u91cd\uff0c\u8bf7\u5c3d\u5feb\u54a8\u8be2\u533b\u7597\u4e13\u4e1a\u4eba\u58eb\u3002"
      : "If the issue persists or gets worse, please see a medical professional.",
    supplementSuggestionError: isChinese
      ? "\u751f\u6210\u8425\u517b\u5efa\u8bae\u65f6\u51fa\u73b0\u9519\u8bef\uff0c\u8bf7\u7a0d\u540e\u518d\u8bd5\u3002"
      : "I ran into an error generating supplement suggestions. Please try again later.",
    genericFallback: isChinese ? "\u62b1\u6b49\uff0c\u6211\u6682\u65f6\u65e0\u6cd5\u751f\u6210\u56de\u590d\u3002\u8bf7\u518d\u8bd5\u4e00\u6b21\u3002" : "I apologize, I couldn't generate a response. Please try again.",
    genericError: (message: string) =>
      isChinese
        ? `\u62b1\u6b49\uff0c\u6211\u9047\u5230\u4e86\u4e00\u4e9b\u9519\u8bef\uff1a${message}\u3002\u8bf7\u7a0d\u540e\u518d\u8bd5\u3002`
        : `I'm sorry, I encountered an error: ${message}. Please try again shortly.`,
    title: isChinese ? "AI \u5065\u5eb7\u987e\u95ee" : "AI Health Advisor",
    subtitle: isChinese ? "\u57fa\u4e8e\u533b\u5b66\u671f\u520a\u8bad\u7ec3" : "Trained on medical journals",
    bloodReportTitle: isChinese ? "\u8bf7\u9009\u62e9\u5206\u6790\u65b9\u5f0f" : "Choose analysis mode",
    yesAnalyze: isChinese ? "\u6309\u8840\u6db2\u62a5\u544a\u5206\u6790" : "Analyze as bloodwork",
    noNotBlood: isChinese ? "\u6309\u666e\u901a\u56fe\u7247\u5206\u6790" : "Analyze as regular images",
    questionnaireTitle: isChinese ? "\u7b80\u77ed\u95ee\u5377\uff1f" : "Quick questionnaire?",
    yes: isChinese ? "\u662f" : "Yes",
    no: isChinese ? "\u5426" : "No",
    back: isChinese ? "\u8fd4\u56de" : "Back",
    next: isChinese ? "\u4e0b\u4e00\u6b65" : "Next",
    finish: isChinese ? "\u5b8c\u6210" : "Finish",
    thinking: isChinese ? "\u601d\u8003\u4e2d..." : "Thinking...",
    attachTitle: isChinese ? "\u4e0a\u4f20\u8840\u6db2\u62a5\u544a\u6587\u4ef6" : "Attach bloodwork file",
    inputPlaceholder: isChinese ? "\u54a8\u8be2\u5065\u5eb7\u3001\u8425\u517b\u76f8\u5173\u95ee\u9898..." : "Ask about health, nutrition...",
    send: isChinese ? "\u53d1\u9001" : "Send",
    aiLanguageInstruction: isChinese
      ? "Respond entirely in Simplified Chinese. Keep the tone clear, natural, and medically responsible."
      : "Respond entirely in English. Keep the tone clear, natural, and medically responsible."
  };
  const text = rawText;
  const questionnaireDeclineReply = isChinese
    ? "\u597d\u7684\uff0c\u6211\u4eec\u53ef\u4ee5\u7ee7\u7eed\u800c\u4e0d\u586b\u5199\u95ee\u5377\u3002\u51c6\u5907\u597d\u540e\uff0c\u968f\u65f6\u95ee\u6211\u4efb\u4f55\u5065\u5eb7\u6216\u8425\u517b\u76f8\u5173\u7684\u95ee\u9898\u3002"
    : "No problem, we can continue without the questionnaire. Ask me any health or nutrition question whenever you're ready.";
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
  const uploadSelectionHelpText = isChinese
    ? `\u5df2\u9009\u62e9 ${pendingUploads.length} \u4e2a\u6587\u4ef6\u3002\u5982\u679c\u4f60\u7684\u624b\u673a\u4e0d\u652f\u6301\u591a\u9009\uff0c\u8bf7\u70b9\u4e0b\u9762\u7ee7\u7eed\u9010\u5f20\u6dfb\u52a0\u56fe\u7247\u3002`
    : `${pendingUploads.length} file(s) selected. If your phone does not support multi-select, tap below to add more images one by one.`;
  const addMoreImagesLabel = isChinese ? "\u7ee7\u7eed\u6dfb\u52a0\u56fe\u7247" : "Add more images";
  const [showUploadPrompt, setShowUploadPrompt] = useState(false);
  const [showSupplementPrompt, setShowSupplementPrompt] = useState(false);
  const [showQuestionnairePrompt, setShowQuestionnairePrompt] = useState(false);
  const [questionnaireActive, setQuestionnaireActive] = useState(false);
  const [questionnaireStep, setQuestionnaireStep] = useState(0);
  const [questionnaireCompleted, setQuestionnaireCompleted] = useState(false);
  const [questionnaireDismissed, setQuestionnaireDismissed] = useState(false);
  const [imageAnalysisSummary, setImageAnalysisSummary] = useState("");
  const [chatRecommendations, setChatRecommendations] = useState<RecommendationCardState | null>(null);
  const [lastSymptomQuery, setLastSymptomQuery] = useState("");
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
  }, [messages, chatRecommendations, showUploadPrompt, showSupplementPrompt, showQuestionnairePrompt, questionnaireActive]);

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
    const nextUploads = [...pendingUploads, ...files];
    setPendingUploads(nextUploads);
    const fileNames = files.map((file) => file.name).join(", ");
    const fileMessage: Message = {
      role: "user",
      content:
        files.length === 1
          ? `📎 Added 1 file: ${fileNames}\nTotal selected: ${nextUploads.length}`
          : `📎 Added ${files.length} file(s): ${fileNames}\nTotal selected: ${nextUploads.length}`
    };
    setMessages((prev) => [...prev, fileMessage]);
    setShowUploadPrompt(true);
    event.target.value = "";
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (file.type.startsWith("image/")) {
        const objectUrl = URL.createObjectURL(file);
        const image = new Image();

        image.onload = () => {
          try {
            const maxDimension = 1600;
            const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, Math.round(image.width * scale));
            canvas.height = Math.max(1, Math.round(image.height * scale));
            const context = canvas.getContext("2d");

            if (!context) {
              URL.revokeObjectURL(objectUrl);
              reject(new Error("Canvas not available"));
              return;
            }

            context.drawImage(image, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
            URL.revokeObjectURL(objectUrl);
            resolve(dataUrl.split(",")[1]);
          } catch (error) {
            URL.revokeObjectURL(objectUrl);
            reject(error);
          }
        };

        image.onerror = (error) => {
          URL.revokeObjectURL(objectUrl);
          reject(error);
        };

        image.src = objectUrl;
        return;
      }

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

  const persistChatImageAnalysis = (summary: string, files: File[]) => {
    const analysis = {
      summary,
      concerns: [] as string[],
      strengths: [] as string[],
      recommendations: [] as {
        supplementId: string;
        supplementName: string;
        reason: string;
        priority: "high" | "medium" | "low";
        dosage?: string;
        dosageGramsPerDay?: number;
      }[],
      detailedInsights: [
        {
          category: "Image analysis",
          findings: summary,
          impact: "Generated from AI chat image analysis."
        }
      ]
    };

    persistentStorage.setItem("bloodworkAnalysis", JSON.stringify(analysis));
    persistentStorage.setItem(
      "bloodworkAnalysisMeta",
      JSON.stringify({
        uploadedAt: new Date().toISOString(),
        fileName: files.map((file) => file.name).join(", "),
        fileType: files.length > 1 ? "images" : files[0]?.type || "image-analysis",
        fileSize: files.reduce((sum, file) => sum + file.size, 0)
      })
    );
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

      const normalizedContent = await localizeAssistantText(
        stripDisclaimers(
          response.choices[0].message.content || text.imageAnalyzeFallback
        ),
        language
      ).catch(() =>
        stripDisclaimers(response.choices[0].message.content || text.imageAnalyzeFallback)
      );

      const assistantMessage: Message = {
        role: "assistant",
        content: normalizedContent
      };
      setMessages(prev => [...prev, assistantMessage]);
      persistChatImageAnalysis(assistantMessage.content, [file]);
      setImageAnalysisSummary(assistantMessage.content);
      setShowSupplementPrompt(true);
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
    setShowSupplementPrompt(false);

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
    setChatRecommendations(null);

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
Keep replies concise but complete, and always finish the last sentence cleanly.

If you need more context before giving tailored guidance, ask: "${text.personalizePrompt}"

If you recommend nutrition products, ONLY use items from this list: ${supplementsList}.
Do not recommend anything outside the list.
Do not use markdown or bold formatting (no **). Use plain text only.`
          },
          ...messages.map(m => ({ role: m.role, content: m.content })),
          { role: "user", content: `${content}\n\nQuestionnaire completed: ${questionnaireCompleted ? "yes" : "no"}` }
        ],
        temperature: 0.7,
        max_tokens: 900
      });

      console.log("OpenAI response:", response);

      const cleanedContent = stripDisclaimers(
        response.choices[0].message.content || text.genericFallback
      );
      const localizedContent = await localizeAssistantText(cleanedContent, language).catch(
        () => cleanedContent
      );

      const assistantMessage: Message = {
        role: "assistant",
        content: localizedContent
      };

      setMessages(prev => [...prev, assistantMessage]);

      try {
        const aiRecommendations = await generateChatSupplementRecommendations({
          userMessage: content,
          assistantReply: localizedContent,
          conversationContext: messages.slice(-4).map((message) => `${message.role}: ${message.content}`),
          language
        });

        const nextRecommendations = aiRecommendations ?? buildSymptomRecommendations(content, isChinese);
        setChatRecommendations(nextRecommendations);
        persistRecommendationExample(language, content, localizedContent, nextRecommendations);
      } catch (recommendationError) {
        console.error("Error generating AI chat recommendations:", recommendationError);
        const fallbackRecommendations = buildSymptomRecommendations(content, isChinese);
        setChatRecommendations(fallbackRecommendations);
        persistRecommendationExample(language, content, localizedContent, fallbackRecommendations);
      }
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

  const handleViewChatRecommendations = () => {
    if (!chatRecommendations) return;
    persistChatRecommendations(chatRecommendations, lastSymptomQuery);
    navigate("/supplements");
  };

  const handleSend = async () => {
    if ((!input.trim() && !uploadedFile) || isLoading) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setLastSymptomQuery(currentInput);
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
        content: questionnaireDeclineReply
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
    setShowSupplementPrompt(false);
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

      const normalizedContent = await localizeAssistantText(
        stripDisclaimers(
          response.choices[0].message.content || text.imagesAnalyzeFallback
        ),
        language
      ).catch(() =>
        stripDisclaimers(response.choices[0].message.content || text.imagesAnalyzeFallback)
      );

      const assistantMessage: Message = {
        role: "assistant",
        content: normalizedContent
      };
      setMessages(prev => [...prev, assistantMessage]);
      persistChatImageAnalysis(assistantMessage.content, files);
      setImageAnalysisSummary(assistantMessage.content);
      setShowSupplementPrompt(true);
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

  const handleSupplementPromptNo = () => {
    setShowSupplementPrompt(false);
  };

  const handleSupplementPromptYes = async () => {
    if (!imageAnalysisSummary || isLoading) return;
    setIsLoading(true);
    setShowSupplementPrompt(false);

    try {
      const analysis = await generateSupplementRecommendationsFromContext({
        summary: imageAnalysisSummary
      });

      persistentStorage.setItem("bloodworkAnalysis", JSON.stringify(analysis));
      persistentStorage.setItem(
        "bloodworkAnalysisMeta",
        JSON.stringify({
          uploadedAt: new Date().toISOString(),
          fileName: "AI image analysis",
          fileType: "image-analysis",
          fileSize: 0
        })
      );

      navigate("/supplements");
    } catch (error) {
      console.error("Error generating supplement suggestions:", error);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: text.supplementSuggestionError }
      ]);
    } finally {
      setIsLoading(false);
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
                {repairMojibake(message.content)}
              </div>
            </div>
          ))}
          {showUploadPrompt && (
            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <div style={styles.questionnaireCard}>
                <p style={styles.questionnaireTitle}>{text.bloodReportTitle}</p>
                <p style={styles.helperText}>{uploadSelectionHelpText}</p>
                <div style={styles.questionnaireActions}>
                  <button onClick={handleAttachClick} style={styles.secondaryButton}>{addMoreImagesLabel}</button>
                  <button onClick={handleUploadYes} style={styles.primaryButton}>{text.yesAnalyze}</button>
                  <button onClick={handleUploadNo} style={styles.secondaryButton}>{text.noNotBlood}</button>
                </div>
              </div>
            </div>
          )}
          {showSupplementPrompt && (
            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <div style={styles.questionnaireCard}>
                <p style={styles.questionnaireTitle}>{text.supplementPromptTitle}</p>
                <p style={styles.helperText}>{text.supplementPromptBody}</p>
                <div style={styles.questionnaireActions}>
                  <button onClick={handleSupplementPromptYes} style={styles.primaryButton}>
                    {text.supplementPromptYes}
                  </button>
                  <button onClick={handleSupplementPromptNo} style={styles.secondaryButton}>
                    {text.supplementPromptNo}
                  </button>
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
          {chatRecommendations && (
            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <div style={styles.questionnaireCard}>
                <p style={styles.questionnaireTitle}>{text.chatRecommendationTitle}</p>
                <p style={styles.helperText}>{chatRecommendations.summary}</p>
                <div style={styles.recommendationList}>
                  {chatRecommendations.recommendations.map((recommendation) => (
                    <div key={recommendation.supplementId} style={styles.recommendationItem}>
                      <span style={styles.recommendationName}>{recommendation.supplementName}</span>
                      <span style={styles.recommendationReason}>{recommendation.reason}</span>
                    </div>
                  ))}
                </div>
                <div style={styles.questionnaireActions}>
                  <button onClick={handleViewChatRecommendations} style={styles.primaryButton}>
                    {text.chatRecommendationButton}
                  </button>
                </div>
                <p style={styles.disclaimerText}>{text.chatRecommendationDisclaimer}</p>
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
    display: "grid",
    gap: 10
  },
  primaryButton: {
    width: "100%",
    padding: "10px 14px",
    borderRadius: 10,
    border: "none",
    background: "#C58A4A",
    color: "#FFFFFF",
    fontWeight: 600,
    cursor: "pointer"
  },
  secondaryButton: {
    width: "100%",
    padding: "10px 14px",
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
  },
  recommendationList: {
    display: "grid",
    gap: 10
  },
  recommendationItem: {
    display: "grid",
    gap: 4,
    padding: 12,
    borderRadius: 12,
    background: "#F9FAFB",
    border: "1px solid #E5E7EB"
  },
  recommendationName: {
    fontSize: 14,
    fontWeight: 700,
    color: "#111827"
  },
  recommendationReason: {
    fontSize: 13,
    lineHeight: "18px",
    color: "#4B5563"
  },
  disclaimerText: {
    margin: 0,
    fontSize: 12,
    lineHeight: "18px",
    color: "#6B7280"
  }
} as const;

export default AIChat;
