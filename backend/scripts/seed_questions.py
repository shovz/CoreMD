"""
seed_questions.py — Seed 20 sample MCQs into MongoDB.

Idempotent: questions already present (keyed on question_id) are skipped.

Usage (from project root):
    python backend/scripts/seed_questions.py
"""

import os
import sys
from pathlib import Path
from typing import Any

from pymongo import MongoClient
from pymongo.collection import Collection

# Load .env from backend/ (one level up from scripts/)
try:
    from dotenv import load_dotenv

    _ENV_PATH = Path(__file__).parent.parent / ".env"
    load_dotenv(_ENV_PATH)
except ImportError:
    pass

MONGO_URI: str = os.getenv("MONGO_URI", "mongodb://localhost:27017/CoreMD")

# ---------------------------------------------------------------------------
# Question data — 20 MCQs across 6 specialties
# chapter_ref format: p{part:02d}_c{chapter:03d}  (matches ingestion output)
#   Part 6  = Disorders of the Cardiovascular System
#   Part 7  = Disorders of the Respiratory System
#   Part 9  = Disorders of the Kidney and Urinary Tract
#   Part 10 = Disorders of the Gastrointestinal System
#   Part 12 = Endocrinology and Metabolism
#   Part 13 = Neurological Disorders
# ---------------------------------------------------------------------------

QUESTIONS: list[dict[str, Any]] = [
    # ── Cardiology (Part 6) ──────────────────────────────────────────────────
    {
        "question_id": "q_p06_c238_001",
        "stem": (
            "A 65-year-old man presents with exertional dyspnea and ankle edema. "
            "Which physical exam finding is most consistent with right heart failure?"
        ),
        "options": [
            "S3 gallop at the apex",
            "Jugular venous distension",
            "Bilateral crackles at the lung bases",
            "Displaced apical impulse",
        ],
        "correct_option": 1,
        "explanation": (
            "Jugular venous distension (JVD) reflects elevated right atrial pressure, "
            "the hallmark of right heart failure. S3 gallop and displaced apical impulse "
            "suggest left-sided failure; bilateral crackles indicate pulmonary edema from "
            "left heart failure."
        ),
        "topic": "Cardiology",
        "chapter_ref": "p06_c238",
        "difficulty": "medium",
    },
    {
        "question_id": "q_p06_c238_002",
        "stem": (
            "Which of the following is the FIRST-LINE pharmacologic treatment for a "
            "stable patient with heart failure with reduced ejection fraction (HFrEF)?"
        ),
        "options": [
            "Digoxin",
            "ACE inhibitor (or ARB) + beta-blocker + mineralocorticoid antagonist",
            "Loop diuretic alone",
            "Calcium channel blocker",
        ],
        "correct_option": 1,
        "explanation": (
            "Guideline-directed medical therapy for HFrEF includes ACE inhibitor (or ARB/ARNI), "
            "a beta-blocker, and a mineralocorticoid receptor antagonist (e.g., spironolactone). "
            "Loop diuretics relieve congestion but do not reduce mortality. Calcium channel "
            "blockers (non-dihydropyridine) are generally avoided in HFrEF."
        ),
        "topic": "Cardiology",
        "chapter_ref": "p06_c238",
        "difficulty": "easy",
    },
    {
        "question_id": "q_p06_c241_001",
        "stem": (
            "A 55-year-old woman is found to have a mid-systolic click followed by a "
            "late systolic murmur at the cardiac apex. What is the most likely diagnosis?"
        ),
        "options": [
            "Aortic stenosis",
            "Mitral valve prolapse",
            "Hypertrophic obstructive cardiomyopathy",
            "Tricuspid regurgitation",
        ],
        "correct_option": 1,
        "explanation": (
            "A mid-systolic click followed by a late systolic murmur is the classic "
            "auscultatory finding of mitral valve prolapse (MVP). The click is produced "
            "by tensing of the prolapsing mitral leaflet. HOCM produces a systolic murmur "
            "that increases with Valsalva; aortic stenosis produces a harsh crescendo-"
            "decrescendo murmur radiating to the carotids."
        ),
        "topic": "Cardiology",
        "chapter_ref": "p06_c241",
        "difficulty": "medium",
    },
    {
        "question_id": "q_p06_c245_001",
        "stem": (
            "A 50-year-old man with a blood pressure of 158/96 mmHg on three separate "
            "occasions has no end-organ damage. Which drug class is PREFERRED as "
            "initial monotherapy in a non-Black patient without comorbidities?"
        ),
        "options": [
            "Alpha-1 blocker",
            "Thiazide diuretic, ACE inhibitor, ARB, or calcium channel blocker",
            "Beta-blocker",
            "Loop diuretic",
        ],
        "correct_option": 1,
        "explanation": (
            "Current guidelines recommend thiazide diuretics, ACE inhibitors, ARBs, or "
            "calcium channel blockers as first-line antihypertensive agents for most "
            "patients. Beta-blockers are no longer first-line unless there is a compelling "
            "indication (e.g., heart failure, post-MI). Loop diuretics are not first-line "
            "for uncomplicated hypertension."
        ),
        "topic": "Cardiology",
        "chapter_ref": "p06_c245",
        "difficulty": "easy",
    },
    # ── Pulmonology (Part 7) ─────────────────────────────────────────────────
    {
        "question_id": "q_p07_c285_001",
        "stem": (
            "A 68-year-old male smoker presents with progressive dyspnea on exertion "
            "and a chronic productive cough. Spirometry shows FEV1/FVC = 0.62 and "
            "FEV1 = 55% of predicted. What is the most likely diagnosis?"
        ),
        "options": [
            "Asthma",
            "Chronic obstructive pulmonary disease (COPD)",
            "Idiopathic pulmonary fibrosis",
            "Pulmonary embolism",
        ],
        "correct_option": 1,
        "explanation": (
            "COPD is characterized by persistent, incompletely reversible airflow obstruction "
            "(post-bronchodilator FEV1/FVC < 0.70) in the appropriate clinical context "
            "(smoking history, chronic cough, dyspnea). FEV1 55% predicted corresponds to "
            "GOLD stage II. Asthma shows variable, reversible obstruction. IPF presents "
            "with a restrictive pattern on PFTs."
        ),
        "topic": "Pulmonology",
        "chapter_ref": "p07_c285",
        "difficulty": "easy",
    },
    {
        "question_id": "q_p07_c284_001",
        "stem": (
            "A 28-year-old woman with known asthma presents in acute respiratory "
            "distress. Her peak expiratory flow is 35% of personal best. Which finding "
            "would indicate the MOST severe (life-threatening) attack?"
        ),
        "options": [
            "Mild wheeze on auscultation",
            "Use of accessory muscles",
            "Silent chest on auscultation",
            "SpO2 of 94%",
        ],
        "correct_option": 2,
        "explanation": (
            "A 'silent chest' (absent breath sounds despite respiratory distress) in an "
            "asthma attack indicates severe bronchospasm with minimal airflow — a "
            "life-threatening emergency requiring immediate intervention. Wheezing and "
            "accessory muscle use indicate significant but not necessarily life-threatening "
            "obstruction. SpO2 of 94% warrants oxygen supplementation but is less ominous."
        ),
        "topic": "Pulmonology",
        "chapter_ref": "p07_c284",
        "difficulty": "hard",
    },
    {
        "question_id": "q_p07_c291_001",
        "stem": (
            "A 40-year-old woman on oral contraceptives presents with sudden-onset "
            "pleuritic chest pain and dyspnea. D-dimer is elevated. CT pulmonary "
            "angiography confirms a pulmonary embolism. What is the FIRST-LINE treatment?"
        ),
        "options": [
            "Warfarin alone",
            "Anticoagulation (LMWH, unfractionated heparin, or a DOAC)",
            "Immediate surgical embolectomy",
            "IVC filter placement",
        ],
        "correct_option": 1,
        "explanation": (
            "Anticoagulation is the cornerstone of PE treatment. DOACs (rivaroxaban, "
            "apixaban) are preferred for most hemodynamically stable patients with PE. "
            "LMWH and unfractionated heparin are alternatives. Surgical embolectomy is "
            "reserved for massive PE with hemodynamic instability when thrombolysis is "
            "contraindicated. IVC filters are not a substitute for anticoagulation."
        ),
        "topic": "Pulmonology",
        "chapter_ref": "p07_c291",
        "difficulty": "medium",
    },
    {
        "question_id": "q_p07_c286_001",
        "stem": (
            "A 72-year-old man is admitted with fever, productive cough, and right "
            "lower lobe infiltrate on chest X-ray. He lives independently at home and "
            "has no recent hospitalisation. Which organism is the most likely cause?"
        ),
        "options": [
            "Pseudomonas aeruginosa",
            "Streptococcus pneumoniae",
            "Staphylococcus aureus",
            "Klebsiella pneumoniae",
        ],
        "correct_option": 1,
        "explanation": (
            "Streptococcus pneumoniae is the most common cause of community-acquired "
            "pneumonia (CAP) across all age groups. Pseudomonas and Klebsiella are more "
            "associated with healthcare-associated or hospital-acquired pneumonia. "
            "S. aureus CAP is most common post-influenza."
        ),
        "topic": "Pulmonology",
        "chapter_ref": "p07_c286",
        "difficulty": "easy",
    },
    # ── Nephrology (Part 9) ──────────────────────────────────────────────────
    {
        "question_id": "q_p09_c305_001",
        "stem": (
            "A 60-year-old man with long-standing type 2 diabetes and hypertension "
            "has a serum creatinine of 2.4 mg/dL and eGFR of 28 mL/min/1.73 m². "
            "Urinalysis shows 3+ proteinuria. What CKD stage does this represent?"
        ),
        "options": [
            "CKD Stage 2",
            "CKD Stage 3b",
            "CKD Stage 4",
            "CKD Stage 5",
        ],
        "correct_option": 2,
        "explanation": (
            "CKD staging by KDIGO is based on eGFR: G1 ≥90, G2 60–89, G3a 45–59, "
            "G3b 30–44, G4 15–29, G5 <15 mL/min/1.73 m². An eGFR of 28 mL/min/1.73 m² "
            "places this patient in CKD Stage G4. Proteinuria adds additional risk "
            "stratification (albuminuria category)."
        ),
        "topic": "Nephrology",
        "chapter_ref": "p09_c305",
        "difficulty": "medium",
    },
    {
        "question_id": "q_p09_c304_001",
        "stem": (
            "A 25-year-old woman presents with facial puffiness, periorbital edema, "
            "and foamy urine. Labs show serum albumin 1.8 g/dL and 24-hour urine "
            "protein of 5.2 g. What is the likely syndrome?"
        ),
        "options": [
            "Nephritic syndrome",
            "Nephrotic syndrome",
            "Urinary tract infection",
            "Acute kidney injury",
        ],
        "correct_option": 1,
        "explanation": (
            "Nephrotic syndrome is defined by proteinuria >3.5 g/day, hypoalbuminaemia, "
            "oedema, and hyperlipidaemia/lipiduria. This patient has massive proteinuria "
            "(5.2 g/day) and low albumin. Nephritic syndrome is characterised by "
            "haematuria, hypertension, oliguria, and milder proteinuria."
        ),
        "topic": "Nephrology",
        "chapter_ref": "p09_c304",
        "difficulty": "easy",
    },
    {
        "question_id": "q_p09_c306_001",
        "stem": (
            "A 70-year-old man with CKD stage 5 (eGFR 8 mL/min) develops serum "
            "potassium of 6.8 mEq/L with peaked T waves on ECG. What is the IMMEDIATE "
            "priority treatment?"
        ),
        "options": [
            "Sodium polystyrene sulfonate (Kayexalate)",
            "Intravenous calcium gluconate",
            "Furosemide infusion",
            "Dietary potassium restriction alone",
        ],
        "correct_option": 1,
        "explanation": (
            "Intravenous calcium gluconate immediately stabilizes the cardiac membrane, "
            "counteracting the cardiotoxic effects of hyperkalaemia (peaked T waves, "
            "risk of fatal arrhythmia). It does not lower potassium but buys time for "
            "potassium-lowering measures (insulin/glucose, nebulised salbutamol, dialysis). "
            "Kayexalate acts over hours and is not immediate."
        ),
        "topic": "Nephrology",
        "chapter_ref": "p09_c306",
        "difficulty": "hard",
    },
    # ── Gastroenterology (Part 10) ───────────────────────────────────────────
    {
        "question_id": "q_p10_c329_001",
        "stem": (
            "A 45-year-old man presents with epigastric pain relieved by eating. "
            "Upper endoscopy shows a duodenal ulcer. Which organism is most commonly "
            "associated with this condition?"
        ),
        "options": [
            "Clostridium difficile",
            "Helicobacter pylori",
            "Escherichia coli",
            "Campylobacter jejuni",
        ],
        "correct_option": 1,
        "explanation": (
            "Helicobacter pylori infection is the most common cause of duodenal ulcers "
            "(present in ~90–95% of cases). Eradication therapy significantly reduces "
            "ulcer recurrence. NSAIDs are the second most common cause. C. difficile "
            "causes antibiotic-associated colitis, not peptic ulcer disease."
        ),
        "topic": "Gastroenterology",
        "chapter_ref": "p10_c329",
        "difficulty": "easy",
    },
    {
        "question_id": "q_p10_c330_001",
        "stem": (
            "A 28-year-old woman presents with bloody diarrhoea, crampy abdominal pain, "
            "and tenesmus for 3 months. Colonoscopy shows continuous mucosal inflammation "
            "from the rectum extending proximally. Biopsy shows crypt abscesses. "
            "What is the most likely diagnosis?"
        ),
        "options": [
            "Crohn's disease",
            "Ulcerative colitis",
            "Ischaemic colitis",
            "Infectious colitis",
        ],
        "correct_option": 1,
        "explanation": (
            "Ulcerative colitis (UC) classically presents with continuous colonic "
            "involvement beginning at the rectum. Biopsy shows mucosal inflammation "
            "with crypt abscesses and goblet cell depletion. Crohn's disease shows "
            "skip lesions, transmural inflammation, and can involve any part of the GI "
            "tract. Ischaemic colitis is more common in elderly patients with vascular risk factors."
        ),
        "topic": "Gastroenterology",
        "chapter_ref": "p10_c330",
        "difficulty": "medium",
    },
    {
        "question_id": "q_p10_c361_001",
        "stem": (
            "A 55-year-old male alcoholic presents with jaundice, ascites, and "
            "spider angiomata. Labs show albumin 2.1 g/dL, INR 2.1, and total "
            "bilirubin 4.2 mg/dL. What is the Child-Pugh score component reflected "
            "by these findings?"
        ),
        "options": [
            "Grade A cirrhosis",
            "Grade C cirrhosis",
            "Compensated cirrhosis",
            "Acute hepatitis",
        ],
        "correct_option": 1,
        "explanation": (
            "Child-Pugh score assesses cirrhosis severity using bilirubin, albumin, INR, "
            "ascites, and encephalopathy. Low albumin (2.1 g/dL), elevated INR (2.1), "
            "elevated bilirubin (4.2), and clinical ascites each score 3 points → Child-Pugh "
            "C (≥10 points), indicating severe decompensated cirrhosis with poor prognosis. "
            "Grade A reflects mild disease (compensated)."
        ),
        "topic": "Gastroenterology",
        "chapter_ref": "p10_c361",
        "difficulty": "hard",
    },
    {
        "question_id": "q_p10_c347_001",
        "stem": (
            "A 42-year-old woman presents with episodic right upper quadrant pain after "
            "fatty meals, with nausea and vomiting. Ultrasound shows multiple gallstones "
            "with a thickened gallbladder wall and pericholecystic fluid. Labs show "
            "WBC 14,000/µL. What is the diagnosis?"
        ),
        "options": [
            "Biliary colic",
            "Acute cholecystitis",
            "Choledocholithiasis",
            "Acute pancreatitis",
        ],
        "correct_option": 1,
        "explanation": (
            "Acute cholecystitis is diagnosed by RUQ pain, fever, leukocytosis, and "
            "ultrasound findings of gallstones with gallbladder wall thickening and "
            "pericholecystic fluid (Murphy's sign on US). Biliary colic lacks the "
            "inflammatory signs. Choledocholithiasis presents with jaundice and elevated "
            "LFTs. Pancreatitis is associated with elevated amylase/lipase."
        ),
        "topic": "Gastroenterology",
        "chapter_ref": "p10_c347",
        "difficulty": "medium",
    },
    # ── Endocrinology (Part 12) ──────────────────────────────────────────────
    {
        "question_id": "q_p12_c383_001",
        "stem": (
            "A 52-year-old obese man is found to have fasting glucose of 128 mg/dL "
            "and HbA1c of 7.8% on two separate occasions. He has no cardiovascular "
            "disease. What is the FIRST-LINE pharmacotherapy?"
        ),
        "options": [
            "Insulin glargine",
            "Metformin",
            "Sulfonylurea",
            "GLP-1 receptor agonist",
        ],
        "correct_option": 1,
        "explanation": (
            "Metformin is the preferred initial pharmacologic agent for type 2 diabetes "
            "unless contraindicated (e.g., eGFR <30). It is weight-neutral or promotes "
            "modest weight loss, is inexpensive, and has a well-established safety "
            "profile. Insulin is generally reserved for patients with HbA1c >10% or "
            "symptomatic hyperglycaemia. GLP-1 agonists are preferred in patients with "
            "established cardiovascular disease or obesity."
        ),
        "topic": "Endocrinology",
        "chapter_ref": "p12_c383",
        "difficulty": "easy",
    },
    {
        "question_id": "q_p12_c381_001",
        "stem": (
            "A 35-year-old woman presents with weight gain, cold intolerance, "
            "constipation, and dry skin. TSH is 18 mIU/L and free T4 is low. "
            "What is the treatment of choice?"
        ),
        "options": [
            "Levothyroxine (T4)",
            "Liothyronine (T3)",
            "Propylthiouracil (PTU)",
            "Methimazole",
        ],
        "correct_option": 0,
        "explanation": (
            "Levothyroxine (synthetic T4) is the treatment of choice for hypothyroidism. "
            "T4 is converted peripherally to the active T3 hormone. Pure T3 replacement "
            "is not recommended due to its short half-life and difficulty maintaining "
            "stable levels. PTU and methimazole are anti-thyroid drugs used for "
            "hyperthyroidism, not hypothyroidism."
        ),
        "topic": "Endocrinology",
        "chapter_ref": "p12_c381",
        "difficulty": "easy",
    },
    # ── Neurology (Part 13) ──────────────────────────────────────────────────
    {
        "question_id": "q_p13_c430_001",
        "stem": (
            "A 68-year-old man with atrial fibrillation presents with sudden-onset "
            "right-sided weakness and expressive aphasia that began 45 minutes ago. "
            "CT head shows no haemorrhage. What is the most appropriate immediate treatment?"
        ),
        "options": [
            "Aspirin 325 mg orally",
            "IV alteplase (tPA) if no contraindications",
            "Urgent carotid endarterectomy",
            "Heparin infusion",
        ],
        "correct_option": 1,
        "explanation": (
            "IV alteplase (tPA) is indicated for acute ischaemic stroke within 4.5 hours "
            "of symptom onset if there is no haemorrhage on CT and no absolute "
            "contraindications. Aspirin alone is not sufficient for acute ischaemic "
            "stroke. Carotid endarterectomy is for carotid stenosis after the acute phase. "
            "Anticoagulation with heparin is generally not used in the acute setting due "
            "to haemorrhagic transformation risk."
        ),
        "topic": "Neurology",
        "chapter_ref": "p13_c430",
        "difficulty": "medium",
    },
    {
        "question_id": "q_p13_c429_001",
        "stem": (
            "A 22-year-old woman has had three unprovoked generalised tonic-clonic "
            "seizures over the past year. MRI brain is normal and EEG shows "
            "generalised 3 Hz spike-and-wave discharges. What is the most appropriate "
            "first-line treatment?"
        ),
        "options": [
            "Carbamazepine",
            "Valproate (or lamotrigine if female of childbearing age)",
            "Phenytoin",
            "Levetiracetam as monotherapy — no first-line evidence",
        ],
        "correct_option": 1,
        "explanation": (
            "Generalised epilepsy with 3 Hz spike-and-wave on EEG suggests juvenile "
            "absence epilepsy or juvenile myoclonic epilepsy. Valproate is highly "
            "effective for generalised epilepsies but is teratogenic; lamotrigine is "
            "preferred for women of childbearing potential. Carbamazepine and phenytoin "
            "may worsen absence and myoclonic seizures."
        ),
        "topic": "Neurology",
        "chapter_ref": "p13_c429",
        "difficulty": "hard",
    },
    {
        "question_id": "q_p13_c432_001",
        "stem": (
            "A 75-year-old man presents with insidious-onset resting tremor, "
            "bradykinesia, and cogwheel rigidity. He has a shuffling gait and "
            "difficulty initiating movement. What is the MOST effective initial "
            "symptomatic treatment for motor symptoms?"
        ),
        "options": [
            "Anticholinergic (benztropine)",
            "Levodopa/carbidopa",
            "Selegiline (MAO-B inhibitor)",
            "Amantadine",
        ],
        "correct_option": 1,
        "explanation": (
            "Levodopa combined with carbidopa (a peripheral dopa-decarboxylase inhibitor "
            "that reduces peripheral conversion of levodopa) remains the most effective "
            "symptomatic treatment for Parkinson's disease motor symptoms. Anticholinergics "
            "are used mainly for tremor but have significant cognitive side effects in the "
            "elderly. MAO-B inhibitors and amantadine offer modest symptomatic benefit."
        ),
        "topic": "Neurology",
        "chapter_ref": "p13_c432",
        "difficulty": "medium",
    },
]


def seed(collection: Collection) -> None:  # type: ignore[type-arg]
    inserted = 0
    skipped = 0

    for q in QUESTIONS:
        if collection.find_one({"question_id": q["question_id"]}):
            skipped += 1
        else:
            collection.insert_one(dict(q))
            inserted += 1

    total = len(QUESTIONS)
    print(
        f"Seed complete — {total} questions in dataset: "
        f"{inserted} inserted, {skipped} already present."
    )


def main() -> None:
    client: MongoClient = MongoClient(MONGO_URI)  # type: ignore[type-arg]
    try:
        db_name = MongoClient(MONGO_URI).get_default_database().name  # type: ignore[union-attr]
        db = client.get_database(db_name)
    except Exception:
        # Fallback: parse db name from URI
        db_name = MONGO_URI.rsplit("/", 1)[-1].split("?")[0] or "CoreMD"
        db = client.get_database(db_name)

    collection = db.get_collection("questions")
    collection.create_index("question_id", unique=True, background=True)

    seed(collection)
    client.close()


if __name__ == "__main__":
    main()
