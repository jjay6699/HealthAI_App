export interface Supplement {
  id: string;
  name: string;
  size: string;
  benefits: string[];
  keyNutrients: string[];
}

export const AVAILABLE_SUPPLEMENTS: Supplement[] = [
  {
    id: "wheatgrass-powder",
    name: "Wheatgrass Powder",
    size: "100g",
    benefits: ["Rich in chlorophyll", "Supports detoxification", "Boosts energy"],
    keyNutrients: ["Vitamin A", "Vitamin C", "Iron", "Magnesium"]
  },
  {
    id: "chia-seed",
    name: "Chia Seed",
    size: "",
    benefits: ["High in omega-3", "Rich in fiber", "Supports heart health"],
    keyNutrients: ["Omega-3", "Fiber", "Protein", "Calcium"]
  },
  {
    id: "beetroot-powder",
    name: "Beetroot Powder",
    size: "180g",
    benefits: ["Supports blood pressure", "Enhances athletic performance", "Rich in antioxidants"],
    keyNutrients: ["Nitrates", "Folate", "Vitamin C", "Iron"]
  },
  {
    id: "cacao-powder",
    name: "Cacao Powder",
    size: "",
    benefits: ["Rich in antioxidants", "Mood enhancer", "Heart health"],
    keyNutrients: ["Magnesium", "Iron", "Flavonoids", "Theobromine"]
  },
  {
    id: "just-green",
    name: "Just Green",
    size: "225g",
    benefits: ["Alkalizing blend", "Nutrient-dense", "Supports immunity"],
    keyNutrients: ["Chlorophyll", "Vitamins", "Minerals", "Antioxidants"]
  },
  {
    id: "just-berries",
    name: "Just Berries",
    size: "180g",
    benefits: ["Antioxidant powerhouse", "Supports brain health", "Anti-inflammatory"],
    keyNutrients: ["Anthocyanins", "Vitamin C", "Fiber", "Polyphenols"]
  },
  {
    id: "superfood-collagen",
    name: "Superfood Collagen Tripeptide",
    size: "180g",
    benefits: ["Supports skin health", "Joint support", "Hair and nail strength"],
    keyNutrients: ["Collagen peptides", "Amino acids", "Protein"]
  },
  {
    id: "kale-powder",
    name: "Kale Powder",
    size: "",
    benefits: ["Nutrient-dense superfood", "Supports bone health", "Anti-inflammatory"],
    keyNutrients: ["Vitamin K", "Vitamin A", "Vitamin C", "Calcium"]
  },
  {
    id: "turmeric-powder",
    name: "Turmeric Powder",
    size: "180g",
    benefits: ["Anti-inflammatory", "Supports joint health", "Antioxidant"],
    keyNutrients: ["Curcumin", "Manganese", "Iron", "Potassium"]
  },
  {
    id: "maca-powder",
    name: "Maca Powder",
    size: "180g",
    benefits: ["Energy booster", "Hormone balance", "Enhances stamina"],
    keyNutrients: ["Vitamin C", "Copper", "Iron", "Potassium"]
  },
  {
    id: "matcha-powder",
    name: "Matcha Powder",
    size: "",
    benefits: ["Sustained energy", "Rich in antioxidants", "Mental clarity"],
    keyNutrients: ["L-theanine", "EGCG", "Caffeine", "Chlorophyll"]
  },
  {
    id: "spirulina-powder",
    name: "Spirulina Powder",
    size: "180g",
    benefits: ["Complete protein source", "Supports immunity", "Detoxification"],
    keyNutrients: ["Protein", "B vitamins", "Iron", "Phycocyanin"]
  },
  {
    id: "moringa-leaf-powder",
    name: "Moringa Leaf Powder",
    size: "",
    benefits: ["Nutrient-rich", "Anti-inflammatory", "Blood sugar support"],
    keyNutrients: ["Vitamin A", "Vitamin C", "Calcium", "Potassium"]
  },
  {
    id: "chlorella-powder",
    name: "Chlorella Powder",
    size: "180g",
    benefits: ["Detoxification", "Immune support", "Rich in chlorophyll"],
    keyNutrients: ["Chlorophyll", "Protein", "B vitamins", "Iron"]
  },
  {
    id: "ginger-powder",
    name: "Ginger Powder",
    size: "180g",
    benefits: ["Digestive support", "Anti-inflammatory", "Nausea relief"],
    keyNutrients: ["Gingerol", "Magnesium", "Potassium", "Vitamin B6"]
  },
  {
    id: "acai-berry",
    name: "Acai Berry",
    size: "120g",
    benefits: ["Antioxidant-rich", "Heart health", "Cognitive function"],
    keyNutrients: ["Anthocyanins", "Omega fatty acids", "Fiber", "Vitamin A"]
  },
  {
    id: "barley-grass-powder",
    name: "Barley Grass Powder",
    size: "180g",
    benefits: ["Alkalizing", "Supports detox", "Energy boost"],
    keyNutrients: ["Chlorophyll", "Vitamin C", "Iron", "Calcium"]
  },
  {
    id: "just-slim",
    name: "Just Slim",
    size: "180g",
    benefits: ["Weight management", "Metabolism support", "Appetite control"],
    keyNutrients: ["Fiber", "Green tea extract", "Chromium", "B vitamins"]
  },
  {
    id: "maqui-berry-powder",
    name: "Maqui Berry Powder",
    size: "120g",
    benefits: ["Highest antioxidant content", "Anti-aging", "Blood sugar support"],
    keyNutrients: ["Anthocyanins", "Vitamin C", "Iron", "Potassium"]
  },
  {
    id: "just-mushroom",
    name: "Just Mushroom",
    size: "180g",
    benefits: ["Immune support", "Adaptogenic", "Cognitive function"],
    keyNutrients: ["Beta-glucans", "Vitamin D", "B vitamins", "Selenium"]
  },
  {
    id: "ceylon-cinnamon-powder",
    name: "Ceylon Cinnamon Powder",
    size: "",
    benefits: ["Blood sugar regulation", "Anti-inflammatory", "Antioxidant"],
    keyNutrients: ["Cinnamaldehyde", "Manganese", "Calcium", "Iron"]
  },
  {
    id: "blueberry-powder",
    name: "Blueberry Powder",
    size: "120g",
    benefits: ["Brain health", "Antioxidant-rich", "Heart health"],
    keyNutrients: ["Anthocyanins", "Vitamin C", "Vitamin K", "Manganese"]
  },
  {
    id: "baobab-powder",
    name: "Baobab Powder",
    size: "100g",
    benefits: ["High in vitamin C", "Digestive health", "Energy boost"],
    keyNutrients: ["Vitamin C", "Fiber", "Potassium", "Calcium"]
  },
  {
    id: "natural-cocoa-powder",
    name: "Natural Cocoa Powder",
    size: "180g",
    benefits: ["Mood enhancer", "Heart health", "Antioxidant-rich"],
    keyNutrients: ["Flavonoids", "Magnesium", "Iron", "Theobromine"]
  },
  {
    id: "tomato-powder",
    name: "Tomato Powder",
    size: "120g",
    benefits: ["Rich in lycopene", "Heart health", "Skin protection"],
    keyNutrients: ["Lycopene", "Vitamin C", "Vitamin K", "Potassium"]
  },
  {
    id: "lemon-powder",
    name: "Lemon Powder",
    size: "100g",
    benefits: ["Vitamin C boost", "Alkalizing", "Digestive support"],
    keyNutrients: ["Vitamin C", "Citric acid", "Flavonoids", "Potassium"]
  }
];

