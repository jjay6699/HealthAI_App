export interface ChatRecommendationItem {
  supplementId: string;
  priority: "high" | "medium" | "low";
  reason: string;
  dosage: string;
}

export interface ChatRecommendationCategory {
  id: string;
  label: string;
  triggers: string[];
  recommendations: ChatRecommendationItem[];
}

export const CHAT_RECOMMENDATION_CATEGORIES: ChatRecommendationCategory[] = [
  {
    id: "digestive-stomach",
    label: "stomach discomfort",
    triggers: ["stomach pain", "stomach ache", "gastric", "indigestion", "upset stomach", "abdominal pain", "abdomen pain"],
    recommendations: [
      {
        supplementId: "ginger-powder",
        priority: "high",
        reason: "May support digestion and help with mild stomach discomfort.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "lemon-powder",
        priority: "medium",
        reason: "May support digestion and add a lighter vitamin C-rich option.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "baobab-powder",
        priority: "medium",
        reason: "May support digestive comfort with prebiotic fiber.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "digestive-bloating-reflux",
    label: "bloating or reflux",
    triggers: ["bloating", "bloated", "acid reflux", "heartburn", "nausea", "digestion"],
    recommendations: [
      {
        supplementId: "ginger-powder",
        priority: "high",
        reason: "May help with mild bloating, nausea, and digestive discomfort.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "lemon-powder",
        priority: "medium",
        reason: "May support digestion as a lighter daily add-in.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "digestive-constipation",
    label: "constipation or low fiber intake",
    triggers: ["constipation", "hard stool", "irregular bowel", "low fiber", "gut health", "regularity"],
    recommendations: [
      {
        supplementId: "organic-psyllium-husk",
        priority: "high",
        reason: "May support regularity and gut comfort when fiber intake is low.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "chia-seed",
        priority: "medium",
        reason: "May add fiber and support fullness and digestive regularity.",
        dosage: "Start with 10-15g per day"
      },
      {
        supplementId: "australian-instant-oats",
        priority: "medium",
        reason: "May support digestive health as a steady fiber-rich base.",
        dosage: "Start with 20-40g per day"
      }
    ]
  },
  {
    id: "pain-neck-shoulder",
    label: "neck or shoulder discomfort",
    triggers: ["neck pain", "shoulder pain", "stiff neck", "stiff shoulder", "upper back pain"],
    recommendations: [
      {
        supplementId: "turmeric-powder",
        priority: "high",
        reason: "May support healthy inflammation balance and mild neck or shoulder discomfort.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "superfood-collagen",
        priority: "high",
        reason: "May support joints and connective tissue during recovery.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "kale-powder",
        priority: "low",
        reason: "May add anti-inflammatory plant nutrients for general support.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "pain-joint-muscle",
    label: "joint or muscle discomfort",
    triggers: ["joint pain", "muscle pain", "body ache", "stiffness", "swelling", "inflammation", "back pain"],
    recommendations: [
      {
        supplementId: "turmeric-powder",
        priority: "high",
        reason: "May support healthy inflammation balance and mild joint or muscle discomfort.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "superfood-collagen",
        priority: "high",
        reason: "May support joints, connective tissue, and recovery.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "pea-protein-original",
        priority: "medium",
        reason: "May support muscle maintenance and recovery if intake is low.",
        dosage: "Start with 20-30g per day"
      }
    ]
  },
  {
    id: "energy-fatigue",
    label: "fatigue or low stamina",
    triggers: ["fatigue", "tired", "low energy", "exhausted", "stamina", "burnout", "afternoon slump"],
    recommendations: [
      {
        supplementId: "maca-powder",
        priority: "high",
        reason: "May support energy, stamina, and resilience during busy periods.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "matcha-powder",
        priority: "medium",
        reason: "May support calm, steady energy and alertness.",
        dosage: "Start with 2-5g per day"
      },
      {
        supplementId: "beetroot-powder",
        priority: "medium",
        reason: "May support circulation, stamina, and exercise performance.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "focus-brain",
    label: "focus or brain fog",
    triggers: ["brain fog", "focus", "concentration", "mental clarity", "memory"],
    recommendations: [
      {
        supplementId: "matcha-powder",
        priority: "high",
        reason: "May support focus and steady mental clarity.",
        dosage: "Start with 2-5g per day"
      },
      {
        supplementId: "blueberry-powder",
        priority: "medium",
        reason: "May support brain health and antioxidant protection.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "acai-berry",
        priority: "low",
        reason: "May support antioxidant intake and general cognitive wellness.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "immunity-cold",
    label: "immune support",
    triggers: ["immunity", "cold", "flu", "falling sick", "keep getting sick", "immune"],
    recommendations: [
      {
        supplementId: "lemon-powder",
        priority: "medium",
        reason: "May support vitamin C intake and daily immune support.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "baobab-powder",
        priority: "medium",
        reason: "May support immunity and gut health together.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "spirulina-powder",
        priority: "medium",
        reason: "May support daily nutrient intake and immune balance.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "blood-sugar",
    label: "blood sugar support",
    triggers: ["blood sugar", "glucose", "insulin", "sugar cravings", "energy crash", "metabolism"],
    recommendations: [
      {
        supplementId: "ceylon-cinnamon-powder",
        priority: "high",
        reason: "May support healthy blood sugar balance and metabolism.",
        dosage: "Start with 2-5g per day"
      },
      {
        supplementId: "moringa-leaf-powder",
        priority: "medium",
        reason: "May support metabolic wellness and daily nutrient intake.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "maqui-berry-powder",
        priority: "medium",
        reason: "May support antioxidant and metabolic wellness.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "heart-circulation",
    label: "heart or circulation support",
    triggers: ["heart health", "blood pressure", "circulation", "cholesterol", "cardio"],
    recommendations: [
      {
        supplementId: "beetroot-powder",
        priority: "high",
        reason: "May support circulation, exercise performance, and cardiovascular wellness.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "chia-seed",
        priority: "medium",
        reason: "May support heart-friendly nutrition with fiber and omega-3s.",
        dosage: "Start with 10-15g per day"
      },
      {
        supplementId: "acai-berry",
        priority: "low",
        reason: "May support heart wellness through antioxidant intake.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "skin-hair-nails",
    label: "skin, hair, or nail support",
    triggers: ["skin", "hair", "nails", "glow", "aging", "anti aging"],
    recommendations: [
      {
        supplementId: "superfood-collagen",
        priority: "high",
        reason: "May support skin elasticity, hair, nails, and connective tissue.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "tomato-powder",
        priority: "medium",
        reason: "May support skin wellness with lycopene-rich antioxidant intake.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "blueberry-powder",
        priority: "low",
        reason: "May support antioxidant protection for overall skin wellness.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "exercise-recovery",
    label: "exercise recovery or protein support",
    triggers: ["recovery", "post workout", "protein", "muscle", "gym", "strength training", "workout"],
    recommendations: [
      {
        supplementId: "pea-protein-original",
        priority: "high",
        reason: "May support protein intake, muscle maintenance, and recovery.",
        dosage: "Start with 20-30g per day"
      },
      {
        supplementId: "pea-protein-cacao",
        priority: "medium",
        reason: "May support recovery with a cocoa-based protein option.",
        dosage: "Start with 20-30g per day"
      },
      {
        supplementId: "beetroot-powder",
        priority: "low",
        reason: "May support stamina and performance around training.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "greens-detox",
    label: "greens or detox support",
    triggers: ["detox", "sluggish", "greens", "nutrient gap", "wellness", "general wellness"],
    recommendations: [
      {
        supplementId: "wheatgrass-powder",
        priority: "medium",
        reason: "May support daily greens intake, vitality, and gentle detox pathways.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "chlorella-powder",
        priority: "medium",
        reason: "May support daily greens intake and cleansing support.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "barley-grass-powder",
        priority: "medium",
        reason: "May support greens intake and steady daily energy.",
        dosage: "Start with 5-10g per day"
      }
    ]
  }
];
