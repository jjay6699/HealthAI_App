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
  }
];
