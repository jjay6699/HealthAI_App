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
    triggers: ["bloating", "bloated", "acid reflux", "heartburn", "nausea", "digestion", "gas", "stomach cramps", "abdominal cramps"],
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
    id: "digestive-bloating-after-meals",
    label: "after-meal bloating support",
    triggers: ["bloating after meals", "bloated after eating", "after meals", "after food", "after eating"],
    recommendations: [
      {
        supplementId: "ginger-powder",
        priority: "high",
        reason: "May support digestion when bloating tends to happen after meals.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "baobab-powder",
        priority: "medium",
        reason: "May support digestive comfort and gut-friendly fiber intake after heavier meals.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "digestive-gas-heavy",
    label: "gas-heavy digestive support",
    triggers: ["gas heavy", "gassy", "a lot of gas", "too much gas", "wind", "burping"],
    recommendations: [
      {
        supplementId: "ginger-powder",
        priority: "high",
        reason: "May help support digestive comfort when gas and bloating are prominent.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "lemon-powder",
        priority: "medium",
        reason: "May provide lighter digestion-focused support in gas-heavy complaints.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "digestive-food-triggered",
    label: "food-triggered bloating support",
    triggers: ["food triggered", "certain food", "after certain food", "trigger food", "sensitive to food"],
    recommendations: [
      {
        supplementId: "ginger-powder",
        priority: "medium",
        reason: "May support digestion when symptoms seem food-triggered.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "baobab-powder",
        priority: "medium",
        reason: "May support gut comfort and everyday digestive balance.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "digestive-diarrhea-recovery",
    label: "digestive recovery support",
    triggers: ["diarrhea", "diarrhoea", "loose stool", "watery stool", "upset stomach", "stomach flu"],
    recommendations: [
      {
        supplementId: "ginger-powder",
        priority: "medium",
        reason: "May offer gentle digestive support while the stomach settles.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "lemon-powder",
        priority: "low",
        reason: "May provide a lighter vitamin C option during digestive recovery.",
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
    id: "constipation-incomplete-bowel",
    label: "incomplete bowel movement support",
    triggers: ["incomplete bowel movement", "not fully out", "still feel need to poop", "cannot empty bowel", "unfinished poop"],
    recommendations: [
      {
        supplementId: "organic-psyllium-husk",
        priority: "high",
        reason: "May support regularity and more complete bowel movements when fiber intake is low.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "chia-seed",
        priority: "medium",
        reason: "May add fiber support for regularity and fullness.",
        dosage: "Start with 10-15g per day"
      }
    ]
  },
  {
    id: "constipation-travel",
    label: "travel constipation support",
    triggers: ["travel constipation", "constipated when travel", "travel bowel", "trip constipation"],
    recommendations: [
      {
        supplementId: "organic-psyllium-husk",
        priority: "high",
        reason: "May support regularity during travel-related bowel changes.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "australian-instant-oats",
        priority: "medium",
        reason: "May provide a gentle fiber-rich base while routines are disrupted.",
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
    id: "headache-migraine",
    label: "headache or migraine support",
    triggers: [
      "migraine",
      "migraines",
      "headache",
      "head pain",
      "pain at the back of my head",
      "back of my head",
      "occipital",
      "tension headache"
    ],
    recommendations: [
      {
        supplementId: "turmeric-powder",
        priority: "high",
        reason: "May support healthy inflammation balance for tension-related head or neck discomfort.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "blueberry-powder",
        priority: "medium",
        reason: "May support antioxidant and brain-focused wellness.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "beetroot-powder",
        priority: "medium",
        reason: "May support circulation and overall head and neck wellness.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "pain-joint-muscle",
    label: "joint or muscle discomfort",
    triggers: [
      "joint pain",
      "muscle pain",
      "body ache",
      "stiffness",
      "swelling",
      "inflammation",
      "back pain",
      "lower back pain",
      "upper back pain",
      "back ache",
      "backache",
      "knee pain",
      "knee ache",
      "knees hurt",
      "aching knees",
      "hip pain",
      "ankle pain",
      "elbow pain",
      "wrist pain",
      "leg pain",
      "arm pain",
      "sore joints",
      "sore muscles"
    ],
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
    id: "pain-lower-back",
    label: "back or spine discomfort",
    triggers: ["back pain", "lower back pain", "upper back pain", "back ache", "backache", "back stiffness", "spine discomfort"],
    recommendations: [
      {
        supplementId: "turmeric-powder",
        priority: "high",
        reason: "May support healthy inflammation balance and everyday back discomfort.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "superfood-collagen",
        priority: "high",
        reason: "May support connective tissue and recovery for recurring back strain.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "pea-protein-original",
        priority: "medium",
        reason: "May support muscle maintenance and recovery if overall protein intake is low.",
        dosage: "Start with 20-30g per day"
      }
    ]
  },
  {
    id: "stress-tension",
    label: "stress or tension support",
    triggers: ["stress", "stressed", "tension", "tense", "burnout", "overwhelmed"],
    recommendations: [
      {
        supplementId: "maca-powder",
        priority: "medium",
        reason: "May support resilience and steady daily energy during stressful periods.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "cacao-powder",
        priority: "medium",
        reason: "May support mood and antioxidant intake during high-stress periods.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "natural-cocoa-powder",
        priority: "low",
        reason: "May support mood and general wellbeing as a cocoa-based option.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "mood-support",
    label: "mood or emotional balance",
    triggers: ["low mood", "feeling down", "down lately", "irritable", "mood swings", "emotionally drained"],
    recommendations: [
      {
        supplementId: "cacao-powder",
        priority: "medium",
        reason: "May support mood and antioxidant intake during emotionally draining periods.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "natural-cocoa-powder",
        priority: "medium",
        reason: "May offer a cocoa-based mood-supportive option.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "maca-powder",
        priority: "low",
        reason: "May support resilience and daily wellbeing when energy and mood feel low.",
        dosage: "Start with 5-10g per day"
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
    id: "sleep-support",
    label: "sleep support",
    triggers: ["trouble sleeping", "poor sleep", "cant sleep", "can't sleep", "cannot sleep", "wake up often", "waking often", "sleep quality", "insomnia"],
    recommendations: [
      {
        supplementId: "cacao-powder",
        priority: "low",
        reason: "May support mood and relaxation routines when sleep is being disrupted by stress.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "natural-cocoa-powder",
        priority: "low",
        reason: "May fit a gentler nightly routine when the goal is comfort rather than energy.",
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
    id: "allergy-sinus-support",
    label: "allergy or sinus support",
    triggers: ["allergy", "sinus", "sneezing", "runny nose", "blocked nose", "stuffy nose", "sinus pressure"],
    recommendations: [
      {
        supplementId: "lemon-powder",
        priority: "medium",
        reason: "May support everyday immune and sinus-supportive routines with vitamin C.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "baobab-powder",
        priority: "medium",
        reason: "May support immune health and general recovery during mild allergy-like periods.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "spirulina-powder",
        priority: "low",
        reason: "May support nutrient intake and daily immune balance.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "sinus-runny-nose",
    label: "runny nose support",
    triggers: ["runny nose", "watery nose", "nose running"],
    recommendations: [
      {
        supplementId: "lemon-powder",
        priority: "medium",
        reason: "May support immune-supportive routines during mild runny-nose complaints.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "baobab-powder",
        priority: "low",
        reason: "May support daily recovery and vitamin C intake.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "sinus-blocked-nose",
    label: "blocked nose support",
    triggers: ["blocked nose", "stuffy nose", "nose blocked", "cannot breathe through nose"],
    recommendations: [
      {
        supplementId: "lemon-powder",
        priority: "medium",
        reason: "May support immune-supportive nutrition in mild blocked-nose situations.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "spirulina-powder",
        priority: "low",
        reason: "May support general nutrient intake during mild sinus discomfort.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "sinus-post-nasal-drip",
    label: "post-nasal drip support",
    triggers: ["post nasal drip", "mucus in throat", "drip in throat"],
    recommendations: [
      {
        supplementId: "ginger-powder",
        priority: "medium",
        reason: "May offer warming support for mild throat and sinus-related irritation.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "lemon-powder",
        priority: "low",
        reason: "May support recovery-oriented hydration routines.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "cough-throat-support",
    label: "cough or sore throat support",
    triggers: ["cough", "sore throat", "throat pain", "scratchy throat", "dry throat", "mild cough"],
    recommendations: [
      {
        supplementId: "ginger-powder",
        priority: "medium",
        reason: "May offer warming support for mild throat or cough discomfort.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "lemon-powder",
        priority: "medium",
        reason: "May support vitamin C intake during mild throat or cough symptoms.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "baobab-powder",
        priority: "low",
        reason: "May support general recovery and immune-supportive nutrition.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "cough-dry-support",
    label: "dry cough support",
    triggers: ["dry cough", "no phlegm cough", "tickly cough"],
    recommendations: [
      {
        supplementId: "ginger-powder",
        priority: "medium",
        reason: "May offer warming support for mild dry-cough discomfort.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "lemon-powder",
        priority: "low",
        reason: "May support immune-oriented recovery routines in mild dry cough cases.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "cough-phlegmy-support",
    label: "phlegmy cough support",
    triggers: ["phlegmy cough", "cough with phlegm", "cough with mucus", "wet cough"],
    recommendations: [
      {
        supplementId: "ginger-powder",
        priority: "medium",
        reason: "May offer warming support in mild phlegmy-cough cases.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "baobab-powder",
        priority: "low",
        reason: "May support general recovery and daily nutrition while symptoms settle.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "eye-strain-screen",
    label: "eye strain or screen fatigue",
    triggers: ["eye strain", "screen fatigue", "tired eyes", "dry eyes", "computer eyes", "screen time", "blur after screen"],
    recommendations: [
      {
        supplementId: "blueberry-powder",
        priority: "medium",
        reason: "May support antioxidant intake for eye and screen-fatigue routines.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "acai-berry",
        priority: "low",
        reason: "May support antioxidant-rich nutrition for general eye and cognitive wellness.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "maqui-berry-powder",
        priority: "low",
        reason: "May support antioxidant intake during high screen-time periods.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "office-wrist-strain",
    label: "wrist or mouse-hand support",
    triggers: ["wrist strain", "mouse hand", "hand from mouse", "typing wrist pain", "desk wrist pain"],
    recommendations: [
      {
        supplementId: "turmeric-powder",
        priority: "medium",
        reason: "May support healthy inflammation balance for repetitive wrist strain.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "superfood-collagen",
        priority: "medium",
        reason: "May support connective tissue during repetitive hand and wrist use.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "office-laptop-neck",
    label: "laptop neck support",
    triggers: ["neck from laptop", "laptop neck", "screen neck pain", "desk neck pain"],
    recommendations: [
      {
        supplementId: "turmeric-powder",
        priority: "high",
        reason: "May support healthy inflammation balance for posture-related neck strain.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "superfood-collagen",
        priority: "medium",
        reason: "May support connective tissue and recovery in recurring desk-related neck stiffness.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "office-screen-headache",
    label: "screen headache support",
    triggers: ["screen headache", "headache from screen", "computer headache", "laptop headache"],
    recommendations: [
      {
        supplementId: "blueberry-powder",
        priority: "medium",
        reason: "May support antioxidant intake during screen-heavy days.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "turmeric-powder",
        priority: "medium",
        reason: "May support tension-related head and neck discomfort from prolonged screen use.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "mouth-gum-support",
    label: "mouth ulcer or gum support",
    triggers: ["mouth ulcer", "mouth ulcers", "gum pain", "gum sensitivity", "sore gums", "mouth sore"],
    recommendations: [
      {
        supplementId: "lemon-powder",
        priority: "low",
        reason: "May support vitamin C intake for general oral-supportive nutrition.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "baobab-powder",
        priority: "low",
        reason: "May support immune and vitamin C intake during mild mouth discomfort.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "spirulina-powder",
        priority: "low",
        reason: "May support overall nutrient intake while recovering from minor mouth irritation.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "tooth-oral-discomfort-support",
    label: "tooth or oral discomfort support",
    triggers: ["tooth pain", "toothache", "tooth ache", "teeth pain", "sensitive tooth", "tooth sensitive", "jaw pain from tooth"],
    recommendations: [
      {
        supplementId: "lemon-powder",
        priority: "low",
        reason: "May support vitamin C intake and general oral-supportive nutrition in mild tooth discomfort situations.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "baobab-powder",
        priority: "low",
        reason: "May support recovery-oriented nutrition and vitamin C intake during mild oral discomfort.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "spirulina-powder",
        priority: "low",
        reason: "May support overall nutrient intake while recovering from minor oral irritation.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "urinary-discomfort-support",
    label: "mild urinary discomfort support",
    triggers: ["urinary discomfort", "pee pain", "burning pee", "burning when urinate", "frequent urination", "urine discomfort", "bladder discomfort"],
    recommendations: [
      {
        supplementId: "lemon-powder",
        priority: "low",
        reason: "May support hydration-friendly daily routines in mild, non-critical discomfort cases.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "baobab-powder",
        priority: "low",
        reason: "May support general recovery and hydration-supportive nutrition.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "circulation-cold-extremities",
    label: "circulation or cold extremities",
    triggers: ["cold hands", "cold feet", "poor circulation", "circulation", "always cold", "numb hands", "numb feet"],
    recommendations: [
      {
        supplementId: "beetroot-powder",
        priority: "high",
        reason: "May support circulation and blood flow.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "ginger-powder",
        priority: "medium",
        reason: "May offer warming support and help with general circulation comfort.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "acai-berry",
        priority: "low",
        reason: "May support overall cardiovascular-friendly antioxidant intake.",
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
    id: "weight-satiety",
    label: "satiety or balanced eating support",
    triggers: ["always hungry", "snacking", "snack a lot", "need something filling", "satiety", "feel hungry", "weight support"],
    recommendations: [
      {
        supplementId: "chia-seed",
        priority: "medium",
        reason: "May support fullness and more balanced eating through added fiber.",
        dosage: "Start with 10-15g per day"
      },
      {
        supplementId: "australian-instant-oats",
        priority: "medium",
        reason: "May provide a steady, filling base for more satisfying meals.",
        dosage: "Start with 20-40g per day"
      },
      {
        supplementId: "organic-psyllium-husk",
        priority: "medium",
        reason: "May support fullness and gut health when dietary fiber is low.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "appetite-loss-support",
    label: "appetite loss support",
    triggers: ["appetite loss", "no appetite", "loss of appetite", "dont feel like eating", "cannot eat much"],
    recommendations: [
      {
        supplementId: "ginger-powder",
        priority: "medium",
        reason: "May support digestion and help when appetite feels off.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "lemon-powder",
        priority: "low",
        reason: "May add a lighter, refreshing option when appetite is reduced.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "australian-instant-oats",
        priority: "low",
        reason: "May provide a simple, gentle base when fuller meals feel difficult.",
        dosage: "Start with 20-40g per day"
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
    id: "dry-skin-support",
    label: "dry skin or eczema-like support",
    triggers: ["dry skin", "itchy skin", "eczema", "skin flare", "skin irritation", "rough skin"],
    recommendations: [
      {
        supplementId: "superfood-collagen",
        priority: "medium",
        reason: "May support skin structure and overall skin wellness.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "tomato-powder",
        priority: "low",
        reason: "May support antioxidant intake for skin-supportive routines.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "blueberry-powder",
        priority: "low",
        reason: "May support antioxidant nutrition for overall skin wellness.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "hair-nails-support",
    label: "hair or nail support",
    triggers: ["hair fall", "hair loss", "brittle nails", "weak nails", "thinning hair"],
    recommendations: [
      {
        supplementId: "superfood-collagen",
        priority: "high",
        reason: "May support hair, nails, and connective tissue structure.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "blueberry-powder",
        priority: "low",
        reason: "May support antioxidant intake for overall beauty and wellness support.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "menopause-support",
    label: "menopause or hot flashes support",
    triggers: ["menopause", "hot flashes", "hot flush", "night sweats", "perimenopause"],
    recommendations: [
      {
        supplementId: "maca-powder",
        priority: "medium",
        reason: "May support resilience and general wellbeing during hormonal transitions.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "cacao-powder",
        priority: "low",
        reason: "May support mood and daily comfort during menopausal transitions.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "natural-cocoa-powder",
        priority: "low",
        reason: "May offer a comforting cocoa-based option for overall wellbeing.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "womens-pms-mood",
    label: "PMS mood support",
    triggers: ["pms mood", "period mood swings", "moody before period", "irritable before period"],
    recommendations: [
      {
        supplementId: "cacao-powder",
        priority: "medium",
        reason: "May support mood and comfort during PMS-related mood changes.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "maca-powder",
        priority: "medium",
        reason: "May support resilience and wellbeing during cycle-related mood fluctuations.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "womens-period-fatigue",
    label: "period fatigue support",
    triggers: ["period fatigue", "tired during period", "period low energy", "weak during period"],
    recommendations: [
      {
        supplementId: "maca-powder",
        priority: "medium",
        reason: "May support energy and resilience during cycle-related fatigue.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "beetroot-powder",
        priority: "low",
        reason: "May support circulation and stamina in non-critical low-energy situations.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "womens-perimenopause-sleep",
    label: "perimenopause sleep support",
    triggers: ["perimenopause sleep", "cannot sleep during menopause", "night sweats sleep", "hot flashes at night"],
    recommendations: [
      {
        supplementId: "maca-powder",
        priority: "medium",
        reason: "May support wellbeing during hormonal transitions that affect sleep comfort.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "natural-cocoa-powder",
        priority: "low",
        reason: "May fit a gentler comfort-oriented routine during disrupted nights.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "womens-cycle-support",
    label: "cycle or PMS support",
    triggers: ["pms", "period cramps", "menstrual cramps", "period pain", "cycle symptoms", "hormonal imbalance"],
    recommendations: [
      {
        supplementId: "maca-powder",
        priority: "medium",
        reason: "May support resilience and hormonal wellbeing during cycle-related discomfort.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "turmeric-powder",
        priority: "medium",
        reason: "May support healthy inflammation balance for period-related discomfort.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "cacao-powder",
        priority: "low",
        reason: "May support mood and comfort during PMS or cycle-related stress.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "post-illness-recovery",
    label: "post-illness recovery support",
    triggers: ["recovering from sickness", "post illness", "after flu", "after fever", "recovering", "after sick"],
    recommendations: [
      {
        supplementId: "spirulina-powder",
        priority: "medium",
        reason: "May support nutrient intake and recovery after recent illness.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "baobab-powder",
        priority: "medium",
        reason: "May support recovery and immune-supportive nutrition.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "lemon-powder",
        priority: "low",
        reason: "May support vitamin C intake during recovery.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "recovery-after-antibiotics",
    label: "post-antibiotic recovery support",
    triggers: ["after antibiotics", "post antibiotics", "recovering from antibiotics"],
    recommendations: [
      {
        supplementId: "baobab-powder",
        priority: "medium",
        reason: "May support gut-friendly recovery routines after antibiotics.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "ginger-powder",
        priority: "low",
        reason: "May support digestive comfort when appetite or stomach feels off after antibiotics.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "recovery-after-poor-appetite",
    label: "recovery after poor appetite",
    triggers: ["after poor appetite", "recovering appetite", "eating little for days", "not eating much lately"],
    recommendations: [
      {
        supplementId: "spirulina-powder",
        priority: "medium",
        reason: "May support nutrient intake while getting appetite and intake back on track.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "australian-instant-oats",
        priority: "low",
        reason: "May provide a simple, gentle base when rebuilding intake after poor appetite.",
        dosage: "Start with 20-40g per day"
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
    id: "office-stiffness-support",
    label: "sedentary or office stiffness support",
    triggers: ["sit too long", "office stiffness", "desk job pain", "sedentary", "sitting all day", "computer stiffness", "office worker"],
    recommendations: [
      {
        supplementId: "turmeric-powder",
        priority: "medium",
        reason: "May support healthy inflammation balance for desk-related stiffness.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "superfood-collagen",
        priority: "medium",
        reason: "May support joints and connective tissue during repetitive desk or sitting routines.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "matcha-powder",
        priority: "low",
        reason: "May support focus and energy during long screen-based workdays when appropriate.",
        dosage: "Start with 2-5g per day"
      }
    ]
  },
  {
    id: "general-nutrition-support",
    label: "general nutrition or greens support",
    triggers: ["not eating well", "need more greens", "overall wellness", "daily wellness", "nutrient gap", "want detox", "general support"],
    recommendations: [
      {
        supplementId: "wheatgrass-powder",
        priority: "medium",
        reason: "May support greens intake and general daily wellness.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "spirulina-powder",
        priority: "medium",
        reason: "May support overall nutrient intake and daily energy.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "kale-powder",
        priority: "medium",
        reason: "May help fill greens and micronutrient gaps.",
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
  },
  {
    id: "digestive-ibs-like",
    label: "IBS-like digestive support",
    triggers: ["ibs", "sensitive stomach", "digestive flare", "stomach flare", "alternating constipation diarrhea", "sensitive gut", "gut flare"],
    recommendations: [
      {
        supplementId: "ginger-powder",
        priority: "high",
        reason: "May support digestive comfort when the gut feels sensitive or easily triggered.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "baobab-powder",
        priority: "medium",
        reason: "May support gut-friendly daily fiber intake in mild IBS-like patterns.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "lemon-powder",
        priority: "low",
        reason: "May provide a lighter digestion-supportive option during mild flares.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "digestive-cramping",
    label: "stomach cramp support",
    triggers: ["stomach cramps", "abdominal cramps", "cramps after eating", "gut cramps", "tummy cramps", "cramping stomach"],
    recommendations: [
      {
        supplementId: "ginger-powder",
        priority: "high",
        reason: "May help support digestive comfort when cramping and mild nausea are part of the picture.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "baobab-powder",
        priority: "medium",
        reason: "May support digestive balance and gut comfort in recurring mild cramp patterns.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "digestive-reflux-food-trigger",
    label: "food-triggered reflux support",
    triggers: ["reflux after eating", "heartburn after eating", "spicy food reflux", "food reflux", "acid after meals", "burping after meals"],
    recommendations: [
      {
        supplementId: "ginger-powder",
        priority: "medium",
        reason: "May support digestion when mild reflux-type symptoms are tied to meals.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "lemon-powder",
        priority: "low",
        reason: "May fit lighter daily digestion-supportive routines when symptoms are mild.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "fatigue-weakness-dizzy",
    label: "fatigue, weakness, or lightheadedness support",
    triggers: ["weakness", "body weak", "lightheaded", "dizzy", "dizziness", "faintish", "low stamina", "feel drained"],
    recommendations: [
      {
        supplementId: "maca-powder",
        priority: "medium",
        reason: "May support daily energy and resilience when tiredness and weakness are recurring.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "spirulina-powder",
        priority: "medium",
        reason: "May support nutrient intake when overall energy and recovery feel low.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "beetroot-powder",
        priority: "low",
        reason: "May support circulation and stamina in non-urgent low-energy situations.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "focus-mental-fatigue",
    label: "mental fatigue support",
    triggers: ["mental fatigue", "mentally tired", "mind feels slow", "cannot think clearly", "foggy brain", "slow brain"],
    recommendations: [
      {
        supplementId: "matcha-powder",
        priority: "medium",
        reason: "May support steadier focus and alertness when mental fatigue is prominent.",
        dosage: "Start with 2-5g per day"
      },
      {
        supplementId: "blueberry-powder",
        priority: "medium",
        reason: "May support brain-focused antioxidant intake and overall cognitive wellness.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "spirulina-powder",
        priority: "low",
        reason: "May support general nutrient intake when mental and physical energy both feel low.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "sleep-restless",
    label: "restless sleep support",
    triggers: ["restless sleep", "sleep restless", "cannot stay asleep", "wake at night", "broken sleep", "sleep interrupted"],
    recommendations: [
      {
        supplementId: "natural-cocoa-powder",
        priority: "low",
        reason: "May fit a gentler evening comfort routine when sleep feels light or interrupted.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "cacao-powder",
        priority: "low",
        reason: "May support stress-related comfort routines when mild sleep disruption is present.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "allergy-itchy-eyes",
    label: "itchy eyes or allergy support",
    triggers: ["itchy eyes", "watery eyes", "allergy eyes", "eyes itchy", "eye allergy", "red itchy eyes"],
    recommendations: [
      {
        supplementId: "lemon-powder",
        priority: "medium",
        reason: "May support vitamin C intake and mild allergy-supportive routines.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "baobab-powder",
        priority: "medium",
        reason: "May support immune and recovery-oriented nutrition during mild allergy-type symptoms.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "spirulina-powder",
        priority: "low",
        reason: "May support overall nutrient intake during mild allergy-like periods.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "eye-dryness-support",
    label: "dry or tired eye support",
    triggers: ["dry eyes", "eye dryness", "eyes dry", "eye tired", "screen eyes", "eye fatigue"],
    recommendations: [
      {
        supplementId: "blueberry-powder",
        priority: "medium",
        reason: "May support eye-friendly antioxidant intake when eyes feel strained or dry.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "acai-berry",
        priority: "low",
        reason: "May support antioxidant intake for screen-heavy or eye-fatigue days.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "skin-acne-breakout",
    label: "acne or breakout support",
    triggers: ["acne", "pimples", "breakout", "breakouts", "skin breakouts", "hormonal acne", "oily skin"],
    recommendations: [
      {
        supplementId: "tomato-powder",
        priority: "medium",
        reason: "May support skin wellness with antioxidant-rich nutrition during breakout-prone periods.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "blueberry-powder",
        priority: "medium",
        reason: "May support antioxidant protection and overall skin wellness.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "wheatgrass-powder",
        priority: "low",
        reason: "May support overall greens intake and general skin-supportive nutrition.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "skin-redness-inflammation",
    label: "skin redness or irritation support",
    triggers: ["skin redness", "red skin", "inflamed skin", "skin irritation", "sensitive skin", "itchy rash"],
    recommendations: [
      {
        supplementId: "blueberry-powder",
        priority: "medium",
        reason: "May support antioxidant intake for general skin wellness when irritation is mild.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "tomato-powder",
        priority: "low",
        reason: "May support skin-focused antioxidant intake in everyday routines.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "superfood-collagen",
        priority: "low",
        reason: "May support overall skin structure and recovery-oriented nutrition.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "water-retention-puffy",
    label: "water retention or puffiness support",
    triggers: ["water retention", "puffy", "bloating face", "puffy face", "feel swollen", "retain water", "face swollen"],
    recommendations: [
      {
        supplementId: "barley-grass-powder",
        priority: "medium",
        reason: "May support lighter daily greens intake when you feel sluggish or puffy.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "wheatgrass-powder",
        priority: "medium",
        reason: "May support general daily wellness and greens intake in puffy, sluggish-feeling phases.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "lemon-powder",
        priority: "low",
        reason: "May fit hydration-friendly daily routines when puffiness is mild and non-urgent.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "blood-sugar-cravings",
    label: "sugar craving support",
    triggers: ["sugar cravings", "sweet cravings", "crave sugar", "want sweet things", "energy crash after eating", "shaky when hungry"],
    recommendations: [
      {
        supplementId: "ceylon-cinnamon-powder",
        priority: "high",
        reason: "May support steadier blood sugar patterns and cravings in daily routines.",
        dosage: "Start with 2-5g per day"
      },
      {
        supplementId: "australian-instant-oats",
        priority: "medium",
        reason: "May provide a steadier, more filling carbohydrate base for balanced energy.",
        dosage: "Start with 20-40g per day"
      },
      {
        supplementId: "chia-seed",
        priority: "medium",
        reason: "May support fullness and steadier eating patterns through added fiber.",
        dosage: "Start with 10-15g per day"
      }
    ]
  },
  {
    id: "womens-cycle-irregular",
    label: "cycle irregularity support",
    triggers: ["irregular period", "irregular cycles", "late period", "cycle irregular", "period not regular", "missed period"],
    recommendations: [
      {
        supplementId: "maca-powder",
        priority: "medium",
        reason: "May support overall wellbeing and resilience during irregular cycle patterns.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "cacao-powder",
        priority: "low",
        reason: "May support mood and comfort when cycle changes are stressful.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "womens-heavy-period-support",
    label: "heavy period support",
    triggers: ["heavy period", "heavy flow", "period very heavy", "bleeding a lot on period", "strong menstrual flow"],
    recommendations: [
      {
        supplementId: "maca-powder",
        priority: "low",
        reason: "May support daily resilience and energy during cycle-related strain in non-urgent situations.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "spirulina-powder",
        priority: "low",
        reason: "May support nutrient intake during periods of lower energy around the cycle.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "respiratory-hoarse-throat",
    label: "hoarse voice or throat irritation support",
    triggers: ["hoarse voice", "lost voice", "voice gone", "throat irritated", "voice strain", "raspy throat"],
    recommendations: [
      {
        supplementId: "ginger-powder",
        priority: "medium",
        reason: "May offer warming support for mild throat irritation and hoarseness.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "lemon-powder",
        priority: "medium",
        reason: "May support recovery-oriented daily routines during mild throat symptoms.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "respiratory-chesty-recovery",
    label: "chesty cough recovery support",
    triggers: ["chesty cough", "mucus cough", "phlegm", "coughing mucus", "phlegmy", "chest congestion"],
    recommendations: [
      {
        supplementId: "ginger-powder",
        priority: "medium",
        reason: "May offer warming support during mild chesty-cough recovery.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "baobab-powder",
        priority: "low",
        reason: "May support general recovery and immune-supportive nutrition while symptoms settle.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "lemon-powder",
        priority: "low",
        reason: "May support lighter recovery-oriented routines during mild cough symptoms.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "office-posture-upper-body",
    label: "posture or desk strain support",
    triggers: ["bad posture", "posture pain", "desk posture", "rounded shoulders", "screen posture", "office neck shoulder"],
    recommendations: [
      {
        supplementId: "turmeric-powder",
        priority: "medium",
        reason: "May support healthy inflammation balance for recurring posture-related discomfort.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "superfood-collagen",
        priority: "medium",
        reason: "May support connective tissue and recovery during ongoing upper-body strain.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "matcha-powder",
        priority: "low",
        reason: "May support focus during long desk days when the issue is tied to office routines.",
        dosage: "Start with 2-5g per day"
      }
    ]
  },
  {
    id: "urinary-uti-style-support",
    label: "UTI-style urinary discomfort support",
    triggers: ["uti", "urine infection", "urinary tract infection", "pain when peeing", "burning when urinating", "frequent urination", "urinary discomfort"],
    recommendations: [
      {
        supplementId: "lemon-powder",
        priority: "low",
        reason: "May support hydration-friendly daily routines in mild urinary discomfort situations.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "baobab-powder",
        priority: "low",
        reason: "May support general recovery-oriented nutrition while mild urinary symptoms settle.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "digestive-nausea-travel",
    label: "nausea or motion discomfort support",
    triggers: ["travel nausea", "motion sickness", "car sick", "sea sick", "feel nauseous", "queasy", "nausea"],
    recommendations: [
      {
        supplementId: "ginger-powder",
        priority: "high",
        reason: "May support digestion and help with mild nausea or travel-related stomach discomfort.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "lemon-powder",
        priority: "medium",
        reason: "May offer a lighter option when the stomach feels unsettled.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "muscle-cramp-support",
    label: "muscle cramp support",
    triggers: ["muscle cramps", "leg cramps", "calf cramps", "charley horse", "night cramps", "cramps in legs"],
    recommendations: [
      {
        supplementId: "beetroot-powder",
        priority: "medium",
        reason: "May support circulation and muscle performance when cramps happen around activity or fatigue.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "kale-powder",
        priority: "medium",
        reason: "May support mineral-rich daily nutrition for muscle and recovery support.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "turmeric-powder",
        priority: "low",
        reason: "May support recovery if cramping comes with soreness or overuse.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "hydration-sluggish-support",
    label: "hydration or dehydrated support",
    triggers: ["dehydrated", "dry mouth", "feel dehydrated", "sluggish from heat", "heat tired", "need hydration"],
    recommendations: [
      {
        supplementId: "lemon-powder",
        priority: "medium",
        reason: "May fit hydration-friendly daily routines when you feel depleted or dried out.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "baobab-powder",
        priority: "medium",
        reason: "May support recovery-oriented nutrition and a lighter daily add-in.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "barley-grass-powder",
        priority: "low",
        reason: "May support gentle daily greens intake when feeling run down or sluggish.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "cholesterol-heart-support",
    label: "cholesterol support",
    triggers: ["cholesterol", "high cholesterol", "bad cholesterol", "ldl", "lipids", "heart health"],
    recommendations: [
      {
        supplementId: "chia-seed",
        priority: "high",
        reason: "May support heart-friendly nutrition with fiber and omega-3s in daily routines.",
        dosage: "Start with 10-15g per day"
      },
      {
        supplementId: "australian-instant-oats",
        priority: "high",
        reason: "May provide beta-glucan fiber that fits cholesterol-supportive eating patterns.",
        dosage: "Start with 20-40g per day"
      },
      {
        supplementId: "acai-berry",
        priority: "low",
        reason: "May support antioxidant intake for overall cardiovascular-friendly nutrition.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "skin-post-acne-marks",
    label: "post-acne marks or skin recovery support",
    triggers: ["acne marks", "acne scars", "pimple marks", "post acne marks", "skin healing", "uneven skin tone"],
    recommendations: [
      {
        supplementId: "tomato-powder",
        priority: "medium",
        reason: "May support skin-focused antioxidant intake during recovery from breakouts.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "superfood-collagen",
        priority: "medium",
        reason: "May support overall skin structure and recovery-oriented nutrition.",
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
    id: "hormonal-balance-support",
    label: "hormonal balance support",
    triggers: ["hormonal imbalance", "hormonal issues", "hormone balance", "hormones off", "cycle hormones", "pms"],
    recommendations: [
      {
        supplementId: "maca-powder",
        priority: "high",
        reason: "May support resilience and general wellbeing during hormone-related fluctuations.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "cacao-powder",
        priority: "low",
        reason: "May support mood and comfort when hormone-related symptoms feel draining.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "low-libido-support",
    label: "low libido or drive support",
    triggers: ["low libido", "sex drive low", "reduced libido", "low sex drive", "drive feels low"],
    recommendations: [
      {
        supplementId: "maca-powder",
        priority: "medium",
        reason: "May support vitality and daily wellbeing when energy and drive feel low.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "cacao-powder",
        priority: "low",
        reason: "May support mood and overall wellbeing in lower-energy phases.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "greens-poor-diet-recovery",
    label: "poor diet or low produce intake support",
    triggers: ["eat badly", "poor diet", "not enough vegetables", "not enough fruits", "junk food", "eat unhealthy"],
    recommendations: [
      {
        supplementId: "wheatgrass-powder",
        priority: "medium",
        reason: "May help fill greens gaps when daily food quality has been poor.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "spirulina-powder",
        priority: "medium",
        reason: "May support overall nutrient intake when meals have been inconsistent.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "kale-powder",
        priority: "medium",
        reason: "May support micronutrient intake when vegetables are lacking.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "anxiety-calm-support",
    label: "anxiety or jittery support",
    triggers: ["anxiety", "anxious", "panic", "palpitations", "heart racing", "jittery", "racing heart"],
    recommendations: [
      {
        supplementId: "cacao-powder",
        priority: "low",
        reason: "May support mood and calmer daily wellbeing routines when stress feels high.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "natural-cocoa-powder",
        priority: "low",
        reason: "May fit a gentler comfort-oriented routine during tense or jittery periods.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "maca-powder",
        priority: "low",
        reason: "May support resilience in stressful periods when low energy is also part of the picture.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "feverish-immune-recovery",
    label: "feverish or coming-down-with-something support",
    triggers: ["feverish feeling", "falling sick", "coming down with something", "fluish", "body feel hot", "chills"],
    recommendations: [
      {
        supplementId: "lemon-powder",
        priority: "medium",
        reason: "May support vitamin C intake and hydration-friendly recovery routines during mild feel-run-down periods.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "baobab-powder",
        priority: "medium",
        reason: "May support immune-oriented nutrition while mild symptoms are settling.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "spirulina-powder",
        priority: "low",
        reason: "May support overall nutrient intake during recovery-oriented routines.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "skin-eczema-rash-support",
    label: "eczema or rash support",
    triggers: ["eczema", "eczema flare", "itchy rash", "skin rash", "red itchy skin", "rash"],
    recommendations: [
      {
        supplementId: "blueberry-powder",
        priority: "medium",
        reason: "May support antioxidant intake for general skin wellness during mild irritation-prone periods.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "superfood-collagen",
        priority: "low",
        reason: "May support skin structure and recovery-oriented nutrition.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "tomato-powder",
        priority: "low",
        reason: "May support skin-focused antioxidant intake in daily routines.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "weight-snacking-support",
    label: "weight or snacking support",
    triggers: ["weight support", "always hungry", "snacking", "snack a lot", "cannot stop snacking", "cannot lose weight"],
    recommendations: [
      {
        supplementId: "chia-seed",
        priority: "medium",
        reason: "May support fullness and steadier eating patterns through added fiber.",
        dosage: "Start with 10-15g per day"
      },
      {
        supplementId: "organic-psyllium-husk",
        priority: "medium",
        reason: "May support satiety and gut health when appetite feels hard to manage.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "australian-instant-oats",
        priority: "medium",
        reason: "May provide a more filling base for steadier meals and energy.",
        dosage: "Start with 20-40g per day"
      }
    ]
  },
  {
    id: "inflammation-swelling-support",
    label: "inflammation or swelling support",
    triggers: ["inflammation", "body inflamed", "swelling", "swollen joints", "joint pain swelling", "feels inflamed"],
    recommendations: [
      {
        supplementId: "turmeric-powder",
        priority: "high",
        reason: "May support healthy inflammation balance when soreness or swelling is part of the complaint.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "kale-powder",
        priority: "low",
        reason: "May add anti-inflammatory plant nutrients for broader daily support.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "superfood-collagen",
        priority: "low",
        reason: "May support connective tissue and recovery when discomfort is musculoskeletal.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "digestive-burning-burping-support",
    label: "stomach burning or burping support",
    triggers: ["stomach burning", "burning stomach", "burping", "burping a lot", "keep burping", "acid after meals"],
    recommendations: [
      {
        supplementId: "ginger-powder",
        priority: "medium",
        reason: "May support digestion when burning, burping, or mild reflux-type discomfort happens around meals.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "lemon-powder",
        priority: "low",
        reason: "May fit lighter digestion-supportive routines when symptoms are mild.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "digestive-fullness-trapped-gas-support",
    label: "fullness or trapped gas support",
    triggers: ["fullness after small meals", "full very fast", "full after little food", "trapped gas", "gas stuck", "stomach feels full"],
    recommendations: [
      {
        supplementId: "ginger-powder",
        priority: "high",
        reason: "May support digestion and gut comfort when fullness or trapped-gas complaints are present.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "baobab-powder",
        priority: "medium",
        reason: "May support digestive balance and everyday gut comfort.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "digestive-morning-nausea-support",
    label: "morning nausea support",
    triggers: ["morning nausea", "nausea in the morning", "wake up nauseous", "morning stomach discomfort"],
    recommendations: [
      {
        supplementId: "ginger-powder",
        priority: "high",
        reason: "May support digestion and help with mild nausea that tends to happen in the morning.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "lemon-powder",
        priority: "medium",
        reason: "May offer a lighter daily option when the stomach feels unsettled early in the day.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "digestive-food-poisoning-recovery",
    label: "food poisoning recovery support",
    triggers: ["food poisoning recovery", "recovering from food poisoning", "stomach bug recovery", "after food poisoning"],
    recommendations: [
      {
        supplementId: "ginger-powder",
        priority: "low",
        reason: "May offer gentle digestive support while the stomach settles after a rough digestive episode.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "lemon-powder",
        priority: "low",
        reason: "May fit lighter recovery-oriented routines when appetite and digestion are still off.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "womens-spotting-breast-support",
    label: "spotting or breast tenderness support",
    triggers: ["spotting", "breast tenderness", "sore breast before period", "breast sore before period", "cycle breast pain"],
    recommendations: [
      {
        supplementId: "maca-powder",
        priority: "medium",
        reason: "May support resilience and general wellbeing during cycle-related hormonal fluctuations.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "cacao-powder",
        priority: "low",
        reason: "May support mood and comfort during hormonal changes around the cycle.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "womens-ovulation-cycle-acne-support",
    label: "ovulation pain or cycle acne support",
    triggers: ["ovulation pain", "cycle acne", "period acne", "breakout before period", "breakouts before period"],
    recommendations: [
      {
        supplementId: "maca-powder",
        priority: "medium",
        reason: "May support overall wellbeing during cycle-related hormonal changes.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "tomato-powder",
        priority: "low",
        reason: "May support skin-focused antioxidant intake when breakouts seem tied to the cycle.",
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
    id: "energy-afternoon-crash-support",
    label: "afternoon crash or post-meal sleepiness support",
    triggers: ["afternoon crash", "always tired after lunch", "sleepy after meals", "energy crash", "post lunch slump"],
    recommendations: [
      {
        supplementId: "ceylon-cinnamon-powder",
        priority: "medium",
        reason: "May support steadier daily energy patterns when crashes happen after meals.",
        dosage: "Start with 2-5g per day"
      },
      {
        supplementId: "australian-instant-oats",
        priority: "medium",
        reason: "May provide a steadier meal base for more even energy through the day.",
        dosage: "Start with 20-40g per day"
      },
      {
        supplementId: "matcha-powder",
        priority: "low",
        reason: "May support alertness when the issue is daytime slump rather than anxiety or poor sleep.",
        dosage: "Start with 2-5g per day"
      }
    ]
  },
  {
    id: "energy-wired-tired-drained-support",
    label: "wired but tired or mentally drained support",
    triggers: ["wired but tired", "mentally drained", "low motivation", "no motivation", "burned out", "stress eating"],
    recommendations: [
      {
        supplementId: "maca-powder",
        priority: "medium",
        reason: "May support resilience and steadier daily energy when stress and exhaustion overlap.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "cacao-powder",
        priority: "low",
        reason: "May support mood and overall wellbeing during mentally draining periods.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "natural-cocoa-powder",
        priority: "low",
        reason: "May fit a gentler comfort-oriented routine when energy feels emotionally depleted.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "body-foot-hand-ankle-support",
    label: "foot, heel, hand, or ankle discomfort support",
    triggers: ["heel pain", "foot pain", "arch pain", "hand pain", "finger stiffness", "ankle pain", "hip stiffness"],
    recommendations: [
      {
        supplementId: "turmeric-powder",
        priority: "medium",
        reason: "May support healthy inflammation balance for everyday limb or joint discomfort.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "superfood-collagen",
        priority: "medium",
        reason: "May support joints and connective tissue when stiffness or strain is recurring.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "kale-powder",
        priority: "low",
        reason: "May add mineral-rich plant nutrition for broader recovery support.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "post-workout-recovery-support",
    label: "post-workout soreness or slow recovery support",
    triggers: ["post workout soreness", "slow workout recovery", "sore after gym", "recovery after workout", "muscle sore after gym"],
    recommendations: [
      {
        supplementId: "pea-protein-original",
        priority: "high",
        reason: "May support muscle recovery and daily protein intake after training.",
        dosage: "Start with 20-30g per day"
      },
      {
        supplementId: "turmeric-powder",
        priority: "medium",
        reason: "May support recovery when training soreness and inflammation are part of the issue.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "beetroot-powder",
        priority: "low",
        reason: "May support stamina and circulation around active routines.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "skin-oily-dull-support",
    label: "oily or dull skin support",
    triggers: ["dull skin", "skin not glowing", "oily skin", "face very oily", "skin looks tired", "skin looks dull"],
    recommendations: [
      {
        supplementId: "tomato-powder",
        priority: "medium",
        reason: "May support skin-focused antioxidant intake when the concern is dullness or frequent oiliness.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "blueberry-powder",
        priority: "medium",
        reason: "May support antioxidant protection for overall skin wellness.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "wheatgrass-powder",
        priority: "low",
        reason: "May support overall greens intake and daily skin-supportive nutrition.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "hair-nails-fragile-support",
    label: "hair shedding or fragile hair/nails support",
    triggers: ["hair shedding", "hair dropping a lot", "brittle hair", "weak nails", "hair thinning after stress", "hair feels weak"],
    recommendations: [
      {
        supplementId: "superfood-collagen",
        priority: "high",
        reason: "May support hair, nails, and connective tissue structure when fragility is the complaint.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "blueberry-powder",
        priority: "low",
        reason: "May support antioxidant intake for overall beauty and wellness support.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "womens-delayed-bloated-cycle-support",
    label: "delayed period or cycle bloating support",
    triggers: ["missed period", "late period", "delayed period", "cycle bloating", "bloating before period", "period delayed"],
    recommendations: [
      {
        supplementId: "maca-powder",
        priority: "medium",
        reason: "May support general wellbeing during cycle changes and hormonal fluctuations.",
        dosage: "Start with 5-10g per day"
      },
      {
        supplementId: "cacao-powder",
        priority: "low",
        reason: "May support comfort and mood when cycle-related changes feel draining.",
        dosage: "Start with 5-10g per day"
      }
    ]
  },
  {
    id: "metabolic-appetite-support",
    label: "appetite, junk cravings, or metabolism support",
    triggers: ["weak when hungry", "craving junk food", "slow metabolism", "belly fat", "after work fatigue", "always tired after work"],
    recommendations: [
      {
        supplementId: "ceylon-cinnamon-powder",
        priority: "medium",
        reason: "May support steadier eating patterns and metabolic-friendly daily routines.",
        dosage: "Start with 2-5g per day"
      },
      {
        supplementId: "chia-seed",
        priority: "medium",
        reason: "May support fullness and steadier appetite through added fiber.",
        dosage: "Start with 10-15g per day"
      },
      {
        supplementId: "australian-instant-oats",
        priority: "medium",
        reason: "May provide a more filling and steady meal base for daily energy support.",
        dosage: "Start with 20-40g per day"
      }
    ]
  }
];
