// GENERATED FILE. DO NOT EDIT. Run npm run data:build to regenerate.

export const termSearchIndex = {
  "adenoma": "term:adenoma",
  "adrenal": "term:adrenal",
  "arthralgia": "term:arthralgia",
  "bradycardia": "term:bradycardia",
  "cytokine": "term:cytokine",
  "dermatitis": "term:dermatitis",
  "endocarditis": "term:endocarditis",
  "gastroscopy": "term:gastroscopy",
  "hepatomegaly": "term:hepatomegaly",
  "hyperglycemia": "term:hyperglycemia",
  "hypoglycemia": "term:hypoglycemia",
  "nephritis": "term:nephritis",
  "neuropathy": "term:neuropathy",
  "osteoplasty": "term:osteoplasty",
  "pericarditis": "term:pericarditis",
  "tachycardia": "term:tachycardia",
  "thrombocyte": "term:thrombocyte"
} as const;

export const termRouteIndex = {
  "adenoma": "adenoma",
  "adrenal": "adrenal",
  "arthralgia": "arthralgia",
  "bradycardia": "bradycardia",
  "cytokine": "cytokine",
  "dermatitis": "dermatitis",
  "endocarditis": "endocarditis",
  "gastroscopy": "gastroscopy",
  "hepatomegaly": "hepatomegaly",
  "hyperglycaemia": "hyperglycemia",
  "hyperglycemia": "hyperglycemia",
  "hypoglycaemia": "hypoglycemia",
  "hypoglycemia": "hypoglycemia",
  "nephritis": "nephritis",
  "neuropathy": "neuropathy",
  "osteoplasty": "osteoplasty",
  "pericarditis": "pericarditis",
  "tachycardia": "tachycardia",
  "thrombocyte": "thrombocyte"
} as const;

export const partToTermUsage = {
  "combining:cyt-o": [
    "term:cytokine"
  ],
  "combining:glyc-o": [
    "term:hyperglycemia",
    "term:hypoglycemia"
  ],
  "prefix:ad": [
    "term:adrenal"
  ],
  "prefix:brady": [
    "term:bradycardia"
  ],
  "prefix:endo": [
    "term:endocarditis"
  ],
  "prefix:hyper": [
    "term:hyperglycemia"
  ],
  "prefix:hypo": [
    "term:hypoglycemia"
  ],
  "prefix:peri": [
    "term:pericarditis"
  ],
  "prefix:tachy": [
    "term:tachycardia"
  ],
  "root:aden": [
    "term:adenoma"
  ],
  "root:adeno": [],
  "root:adren": [
    "term:adrenal"
  ],
  "root:adreno": [],
  "root:arthr": [
    "term:arthralgia"
  ],
  "root:arthro": [],
  "root:card": [
    "term:bradycardia",
    "term:endocarditis",
    "term:pericarditis",
    "term:tachycardia"
  ],
  "root:cardi": [],
  "root:cardio": [],
  "root:derm": [],
  "root:dermat": [
    "term:dermatitis"
  ],
  "root:dermato": [],
  "root:gastr": [],
  "root:gastro": [
    "term:gastroscopy"
  ],
  "root:hepat": [],
  "root:hepato": [
    "term:hepatomegaly"
  ],
  "root:nephr": [
    "term:nephritis"
  ],
  "root:nephro": [],
  "root:neur": [
    "term:neuropathy"
  ],
  "root:neuro": [],
  "root:oste": [],
  "root:osteo": [
    "term:osteoplasty"
  ],
  "root:ren": [
    "term:adrenal"
  ],
  "root:reno": [],
  "root:thromb": [],
  "root:thrombo": [
    "term:thrombocyte"
  ],
  "suffix:al": [
    "term:adrenal"
  ],
  "suffix:algia": [
    "term:arthralgia"
  ],
  "suffix:cyte": [
    "term:thrombocyte"
  ],
  "suffix:emia": [
    "term:hyperglycemia",
    "term:hypoglycemia"
  ],
  "suffix:ia": [
    "term:bradycardia",
    "term:tachycardia"
  ],
  "suffix:itis": [
    "term:dermatitis",
    "term:endocarditis",
    "term:nephritis",
    "term:pericarditis"
  ],
  "suffix:kine": [
    "term:cytokine"
  ],
  "suffix:megaly": [
    "term:hepatomegaly"
  ],
  "suffix:oma": [
    "term:adenoma"
  ],
  "suffix:opathy": [
    "term:neuropathy"
  ],
  "suffix:plasty": [
    "term:osteoplasty"
  ],
  "suffix:scopy": [
    "term:gastroscopy"
  ]
} as const;

export const relatedTermIds = {
  "term:adenoma": [],
  "term:adrenal": [],
  "term:arthralgia": [],
  "term:bradycardia": [
    "term:tachycardia"
  ],
  "term:cytokine": [],
  "term:dermatitis": [],
  "term:endocarditis": [
    "term:pericarditis"
  ],
  "term:gastroscopy": [],
  "term:hepatomegaly": [],
  "term:hyperglycemia": [
    "term:hypoglycemia"
  ],
  "term:hypoglycemia": [
    "term:hyperglycemia"
  ],
  "term:nephritis": [],
  "term:neuropathy": [],
  "term:osteoplasty": [],
  "term:pericarditis": [
    "term:endocarditis"
  ],
  "term:tachycardia": [
    "term:bradycardia"
  ],
  "term:thrombocyte": []
} as const;

export const sourceCitations = {
  "source:medlineplus-appendix-a": {
    "terms": [
      "term:arthralgia",
      "term:dermatitis",
      "term:endocarditis",
      "term:gastroscopy",
      "term:hepatomegaly",
      "term:nephritis",
      "term:neuropathy",
      "term:osteoplasty",
      "term:pericarditis",
      "term:thrombocyte"
    ],
    "parts": [
      "prefix:ad",
      "prefix:brady",
      "prefix:endo",
      "prefix:hyper",
      "prefix:hypo",
      "prefix:peri",
      "prefix:tachy",
      "root:arthr",
      "root:arthro",
      "root:cardi",
      "root:cardio",
      "root:derm",
      "root:dermato",
      "root:gastr",
      "root:gastro",
      "root:hepat",
      "root:hepato",
      "root:nephr",
      "root:nephro",
      "root:neur",
      "root:neuro",
      "root:oste",
      "root:osteo",
      "root:thromb",
      "root:thrombo",
      "suffix:al",
      "suffix:algia",
      "suffix:cyte",
      "suffix:emia",
      "suffix:itis",
      "suffix:megaly",
      "suffix:opathy",
      "suffix:plasty",
      "suffix:scopy"
    ],
    "aliases": [],
    "relations": [
      "contrast:term:hypoglycemia:term:hyperglycemia",
      "contrast:term:tachycardia:term:bradycardia",
      "related:term:endocarditis:term:pericarditis"
    ]
  },
  "source:ncbi-medical-terminology": {
    "terms": [
      "term:adenoma",
      "term:adrenal",
      "term:bradycardia",
      "term:cytokine",
      "term:hyperglycemia",
      "term:hypoglycemia",
      "term:tachycardia"
    ],
    "parts": [
      "combining:cyt-o",
      "combining:glyc-o",
      "root:aden",
      "root:adeno",
      "root:adren",
      "root:adreno",
      "root:card",
      "root:dermat",
      "root:ren",
      "root:reno",
      "suffix:ia",
      "suffix:oma"
    ],
    "aliases": [
      "hyperglycaemia",
      "hypoglycaemia"
    ],
    "relations": []
  },
  "source:nci-adenoma": {
    "terms": [
      "term:adenoma"
    ],
    "parts": [],
    "aliases": [],
    "relations": []
  },
  "source:nci-cytokine": {
    "terms": [
      "term:cytokine"
    ],
    "parts": [
      "suffix:kine"
    ],
    "aliases": [],
    "relations": []
  },
  "source:nci-osteoplasty": {
    "terms": [
      "term:osteoplasty"
    ],
    "parts": [],
    "aliases": [],
    "relations": []
  }
} as const;
