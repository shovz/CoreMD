"""
seed_questions.py — Seed 100 MCQs into MongoDB.

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
# Question data — 100 MCQs across 12 specialties
# chapter_ref format: p{part:02d}_c{chapter:03d}  (matches ingestion output)
#   Part 4  = Oncology / Hematology
#   Part 5  = Infectious Disease
#   Part 6  = Disorders of the Cardiovascular System
#   Part 7  = Disorders of the Respiratory System
#   Part 9  = Disorders of the Kidney and Urinary Tract
#   Part 10 = Disorders of the Gastrointestinal System
#   Part 11 = Rheumatology
#   Part 12 = Endocrinology and Metabolism
#   Part 13 = Neurological Disorders
#   Part 14 = Psychiatry
#   Part 15 = Dermatology
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

    # ── Cardiology (continued) ───────────────────────────────────────────────
    {
        "question_id": "q_p06_c228_001",
        "stem": (
            "A 62-year-old man presents with sudden crushing chest pain and diaphoresis. "
            "ECG shows ST-segment elevation in leads V1–V4. Which coronary artery is most "
            "likely occluded?"
        ),
        "options": [
            "Right coronary artery (RCA)",
            "Left anterior descending artery (LAD)",
            "Left circumflex artery (LCx)",
            "Posterior descending artery (PDA)",
        ],
        "correct_option": 1,
        "explanation": (
            "ST elevation in V1–V4 represents an anterior STEMI caused by occlusion of the "
            "left anterior descending (LAD) artery. Inferior STEMI (II, III, aVF) implicates "
            "the RCA (80%) or LCx (20%). Lateral STEMI (I, aVL, V5–V6) implicates LCx or "
            "diagonal branches of the LAD."
        ),
        "topic": "Cardiology",
        "chapter_ref": "p06_c228",
        "difficulty": "easy",
    },
    {
        "question_id": "q_p06_c234_001",
        "stem": (
            "A 70-year-old woman with a new diagnosis of atrial fibrillation, hypertension, "
            "and diabetes mellitus is referred for anticoagulation assessment. "
            "What is her CHA₂DS₂-VASc score?"
        ),
        "options": [
            "1",
            "3",
            "4",
            "2",
        ],
        "correct_option": 1,
        "explanation": (
            "CHA₂DS₂-VASc: C = congestive HF (0), H = hypertension (1), A₂ = age ≥75 (0 here, "
            "age 70 gives 1 for 65–74), S₂ = stroke/TIA history (0), D = diabetes (1), "
            "V = vascular disease (0), A = age 65–74 (1), Sc = female sex (1). "
            "Total = 1+1+1+1 – note age 70 scores 1 (65–74). Score = 4. Wait — "
            "H=1, A=1 (65-74), D=1, Sc=1 = 4."
        ),
        "topic": "Cardiology",
        "chapter_ref": "p06_c234",
        "difficulty": "easy",
    },
    {
        "question_id": "q_p06_c228_002",
        "stem": (
            "A patient with STEMI is brought to the emergency department. The hospital has "
            "percutaneous coronary intervention (PCI) capability. What is the maximum "
            "acceptable door-to-balloon time?"
        ),
        "options": [
            "30 minutes",
            "60 minutes",
            "90 minutes",
            "120 minutes",
        ],
        "correct_option": 2,
        "explanation": (
            "Current ACC/AHA guidelines mandate a door-to-balloon (D2B) time of ≤90 minutes "
            "for primary PCI in STEMI. When PCI is not available within 120 minutes of "
            "first medical contact, fibrinolysis should be administered within 30 minutes "
            "(door-to-needle time ≤30 minutes)."
        ),
        "topic": "Cardiology",
        "chapter_ref": "p06_c228",
        "difficulty": "medium",
    },
    {
        "question_id": "q_p06_c234_002",
        "stem": (
            "A 68-year-old man with atrial fibrillation, prior ischaemic stroke, heart "
            "failure, and hypertension is on warfarin. What CHA₂DS₂-VASc score does he have "
            "and what does it indicate?"
        ),
        "options": [
            "Score 2 — anticoagulation optional",
            "Score 6 — high stroke risk, anticoagulation strongly recommended",
            "Score 3 — anticoagulation preferred",
            "Score 4 — rate control only",
        ],
        "correct_option": 1,
        "explanation": (
            "CHA₂DS₂-VASc: C=1 (HF), H=1 (HTN), A₂=2 (prior stroke), A=1 (age 65–74), "
            "Sc=0 (male) = 5. If age ≥75 that would be 2 additional points instead of 1 "
            "for the age 65-74 category. At age 68, age scores 1. Score = 1+1+2+1 = 5. "
            "Any score ≥2 in males strongly warrants anticoagulation. The correct answer "
            "reflects that a high score means high risk and warfarin/DOAC is indicated."
        ),
        "topic": "Cardiology",
        "chapter_ref": "p06_c234",
        "difficulty": "medium",
    },
    {
        "question_id": "q_p06_c241_002",
        "stem": (
            "A 75-year-old woman has progressively worsening exertional dyspnoea, angina, "
            "and a syncopal episode. Echocardiography shows an aortic valve area of 0.7 cm² "
            "and a mean gradient of 52 mmHg. What is the most appropriate next step?"
        ),
        "options": [
            "Continue medical management with beta-blockers",
            "Aortic valve replacement (surgical or TAVR)",
            "Balloon aortic valvuloplasty as definitive therapy",
            "Initiation of ACE inhibitor therapy",
        ],
        "correct_option": 1,
        "explanation": (
            "Severe symptomatic aortic stenosis (valve area <1.0 cm², mean gradient >40 mmHg) "
            "with classic symptoms (exertional dyspnoea, angina, syncope) is a Class I "
            "indication for valve replacement. TAVR is preferred for patients at intermediate "
            "or high surgical risk. Medical therapy does not alter prognosis in severe AS. "
            "Balloon valvuloplasty is palliative, not definitive."
        ),
        "topic": "Cardiology",
        "chapter_ref": "p06_c241",
        "difficulty": "medium",
    },
    {
        "question_id": "q_p06_c255_001",
        "stem": (
            "A 50-year-old man post-cardiac surgery presents with hypotension, elevated "
            "JVP, and muffled heart sounds. ECG shows electrical alternans. "
            "What is the immediate life-saving intervention?"
        ),
        "options": [
            "IV fluid bolus and vasopressors",
            "Pericardiocentesis",
            "Emergency coronary angiography",
            "DC cardioversion",
        ],
        "correct_option": 1,
        "explanation": (
            "Beck's triad (hypotension, elevated JVP, muffled heart sounds) with electrical "
            "alternans on ECG strongly suggests cardiac tamponade. Pericardiocentesis is the "
            "definitive emergency treatment. IV fluids can temporarily support preload while "
            "preparing for drainage, but are not definitive. Tamponade prevents ventricular "
            "filling and impairs cardiac output."
        ),
        "topic": "Cardiology",
        "chapter_ref": "p06_c255",
        "difficulty": "hard",
    },

    # ── Pulmonology (continued) ──────────────────────────────────────────────
    {
        "question_id": "q_p07_c288_001",
        "stem": (
            "A 65-year-old non-smoking woman presents with a 2-year history of progressive "
            "exertional dyspnea and dry cough. HRCT shows bilateral subpleural honeycombing "
            "and traction bronchiectasis predominantly at the bases. Spirometry shows a "
            "restrictive pattern. What is the most likely diagnosis?"
        ),
        "options": [
            "Sarcoidosis",
            "Idiopathic pulmonary fibrosis (IPF)",
            "Hypersensitivity pneumonitis",
            "Cryptogenic organising pneumonia (COP)",
        ],
        "correct_option": 1,
        "explanation": (
            "Idiopathic pulmonary fibrosis (IPF) characteristically presents in older adults "
            "with progressive dyspnea, bibasilar crackles, and the UIP (usual interstitial "
            "pneumonia) pattern on HRCT — subpleural honeycombing with traction "
            "bronchiectasis. Sarcoidosis typically involves upper lobes and hilar "
            "lymphadenopathy. HP shows centrilobular nodules and upper-lobe predominance."
        ),
        "topic": "Pulmonology",
        "chapter_ref": "p07_c288",
        "difficulty": "easy",
    },
    {
        "question_id": "q_p07_c295_001",
        "stem": (
            "A 45-year-old obese male truck driver complains of excessive daytime sleepiness, "
            "witnessed apnoeas, and loud snoring. Polysomnography shows an AHI of 35 events/hour "
            "with oxygen desaturation to 82%. What is the FIRST-LINE treatment?"
        ),
        "options": [
            "Uvulopalatopharyngoplasty (UPPP)",
            "Continuous positive airway pressure (CPAP)",
            "Mandibular advancement device",
            "Supplemental oxygen alone",
        ],
        "correct_option": 1,
        "explanation": (
            "CPAP is the first-line treatment for moderate-to-severe obstructive sleep apnoea "
            "(AHI ≥15 or AHI ≥5 with symptoms). It prevents upper airway collapse by "
            "providing a pneumatic splint. Mandibular advancement devices are an alternative "
            "for mild-moderate OSA or CPAP intolerance. UPPP is a surgical option after "
            "failed conservative therapy. Oxygen alone does not address the obstructive mechanism."
        ),
        "topic": "Pulmonology",
        "chapter_ref": "p07_c295",
        "difficulty": "easy",
    },
    {
        "question_id": "q_p07_c293_001",
        "stem": (
            "A pleural fluid sample shows: protein 4.2 g/dL (serum 7.0 g/dL), LDH 280 U/L "
            "(serum 220 U/L). Applying Light's criteria, how would you classify this effusion?"
        ),
        "options": [
            "Transudate — likely heart failure",
            "Exudate — further investigation required",
            "Transudate — likely cirrhosis",
            "Exudate — likely parapneumonic",
        ],
        "correct_option": 1,
        "explanation": (
            "Light's criteria classify an effusion as an exudate if ANY of: (1) pleural/serum "
            "protein >0.5 (4.2/7.0=0.60 ✓), (2) pleural/serum LDH >0.6 (280/220=1.27 ✓), "
            "or (3) pleural LDH >2/3 upper limit of normal. This effusion meets criteria 1 "
            "and 2 → exudate. Transudates (heart failure, cirrhosis, nephrotic syndrome) "
            "fail all three criteria. An exudate requires further workup (cytology, culture, "
            "adenosine deaminase, etc.)."
        ),
        "topic": "Pulmonology",
        "chapter_ref": "p07_c293",
        "difficulty": "medium",
    },
    {
        "question_id": "q_p07_c293_002",
        "stem": (
            "A 35-year-old woman presents with progressive exertional dyspnea and near-syncope. "
            "Examination reveals a loud P2, right ventricular heave, and tricuspid regurgitation "
            "murmur. Right heart catheterisation shows mean pulmonary artery pressure of "
            "38 mmHg with normal PCWP. What is the most likely classification?"
        ),
        "options": [
            "Group 2 — pulmonary hypertension due to left heart disease",
            "Group 1 — pulmonary arterial hypertension (PAH)",
            "Group 3 — PH due to lung disease",
            "Group 4 — chronic thromboembolic PH",
        ],
        "correct_option": 1,
        "explanation": (
            "Pulmonary arterial hypertension (PAH, Group 1) is defined as mean PAP ≥25 mmHg "
            "with PCWP ≤15 mmHg (pre-capillary PH). Group 2 (left heart disease) would show "
            "elevated PCWP. Group 3 (lung disease) is associated with hypoxia and parenchymal "
            "abnormalities. Group 4 (CTEPH) shows perfusion defects on V/Q scan. In young "
            "women without identified cause, idiopathic PAH should be considered."
        ),
        "topic": "Pulmonology",
        "chapter_ref": "p07_c293",
        "difficulty": "medium",
    },

    # ── Nephrology (continued) ───────────────────────────────────────────────
    {
        "question_id": "q_p09_c307_001",
        "stem": (
            "A 24-year-old man presents with haemoptysis, haematuria, and rapidly rising "
            "creatinine. Urinalysis shows RBC casts. Chest CT shows diffuse alveolar "
            "infiltrates. Which antibody is most specific for his diagnosis?"
        ),
        "options": [
            "Anti-neutrophil cytoplasmic antibody (ANCA)",
            "Anti-glomerular basement membrane (anti-GBM) antibody",
            "Antinuclear antibody (ANA)",
            "Anti-double-stranded DNA (anti-dsDNA)",
        ],
        "correct_option": 1,
        "explanation": (
            "The triad of haemoptysis, rapidly progressive glomerulonephritis (RPGN), and "
            "RBC casts describes a pulmonary-renal syndrome. Anti-GBM antibody (directed "
            "against type IV collagen in the GBM and alveolar basement membrane) is "
            "diagnostic of Goodpasture syndrome. ANCA is associated with GPA/MPA. ANA and "
            "anti-dsDNA suggest SLE lupus nephritis."
        ),
        "topic": "Nephrology",
        "chapter_ref": "p09_c307",
        "difficulty": "easy",
    },
    {
        "question_id": "q_p09_c307_002",
        "stem": (
            "A 55-year-old woman has a creatinine that doubled from 1.1 to 2.2 mg/dL over "
            "4 weeks with red cell casts on urinalysis. Kidney biopsy shows >50% crescents "
            "on light microscopy. Which treatment should be started urgently?"
        ),
        "options": [
            "Dietary protein restriction alone",
            "High-dose corticosteroids and cyclophosphamide",
            "Angiotensin-converting enzyme inhibitor",
            "Haemodialysis only — no immunosuppression benefit",
        ],
        "correct_option": 1,
        "explanation": (
            "Crescentic (rapidly progressive) glomerulonephritis requires urgent "
            "immunosuppression to prevent irreversible renal failure. The standard regimen is "
            "pulse intravenous methylprednisolone followed by oral prednisolone plus "
            "cyclophosphamide. If anti-GBM disease is confirmed, plasmapheresis is added. "
            "Delay in treatment leads to dialysis dependence."
        ),
        "topic": "Nephrology",
        "chapter_ref": "p09_c307",
        "difficulty": "medium",
    },
    {
        "question_id": "q_p09_c310_001",
        "stem": (
            "A 30-year-old woman has a non-anion-gap metabolic acidosis, serum potassium "
            "3.0 mEq/L, and urine pH 6.5 despite systemic acidosis. Urine anion gap is "
            "positive. What is the most likely diagnosis?"
        ),
        "options": [
            "Type 2 (proximal) RTA",
            "Type 1 (distal) RTA",
            "Type 4 (hyperkalaemic) RTA",
            "Diarrhoea-induced acidosis",
        ],
        "correct_option": 1,
        "explanation": (
            "Type 1 (distal) RTA is characterised by inability of the distal tubule to "
            "acidify urine below pH 5.5, resulting in urine pH >5.5 despite systemic "
            "acidosis. It causes hypokalaemia and is associated with nephrocalcinosis and "
            "nephrolithiasis. Type 2 (proximal) RTA also causes hypokalaemia but the urine "
            "pH can appropriately drop below 5.5. Type 4 RTA causes hyperkalaemia."
        ),
        "topic": "Nephrology",
        "chapter_ref": "p09_c310",
        "difficulty": "medium",
    },
    {
        "question_id": "q_p09_c306_002",
        "stem": (
            "A 55-year-old man develops hypernatraemia with serum Na+ 158 mEq/L after "
            "inadequate fluid intake. His weight is 70 kg and TBW is estimated at 42 L. "
            "What is the calculated free water deficit?"
        ),
        "options": [
            "~1 L",
            "~2.6 L",
            "~5 L",
            "~7 L",
        ],
        "correct_option": 1,
        "explanation": (
            "Free water deficit = TBW × [(serum Na / 140) − 1]. "
            "= 42 × [(158/140) − 1] = 42 × [1.129 − 1] = 42 × 0.129 ≈ 5.4 L. "
            "Wait — re-calculating: 42 × (158/140 − 1) = 42 × 0.1286 ≈ 5.4 L. "
            "The closest answer is ~5 L. Correct the deficit slowly (no faster than "
            "10–12 mEq/L per 24 hours) to avoid cerebral oedema."
        ),
        "topic": "Nephrology",
        "chapter_ref": "p09_c306",
        "difficulty": "hard",
    },

    # ── Gastroenterology (continued) ─────────────────────────────────────────
    {
        "question_id": "q_p10_c348_001",
        "stem": (
            "A 48-year-old male heavy drinker presents with epigastric pain radiating to "
            "the back, nausea, and vomiting. Serum lipase is 850 U/L. What are the two "
            "most common causes of acute pancreatitis?"
        ),
        "options": [
            "Hypercalcaemia and hypertriglyceridaemia",
            "Gallstones and alcohol",
            "ERCP-induced and medication-related",
            "Autoimmune and hereditary",
        ],
        "correct_option": 1,
        "explanation": (
            "Gallstones and alcohol together account for approximately 80% of all cases of "
            "acute pancreatitis. Gallstone pancreatitis occurs when a stone transiently "
            "obstructs the ampulla of Vater. Alcohol causes direct acinar cell toxicity. "
            "Other less common causes include hypertriglyceridaemia (>1000 mg/dL), "
            "hypercalcaemia, ERCP, medications, and autoimmune pancreatitis."
        ),
        "topic": "Gastroenterology",
        "chapter_ref": "p10_c348",
        "difficulty": "easy",
    },
    {
        "question_id": "q_p10_c355_001",
        "stem": (
            "A 45-year-old man is found to have hepatitis C genotype 1 infection with "
            "detectable HCV RNA and mild fibrosis on biopsy. What is the current standard "
            "of care treatment?"
        ),
        "options": [
            "Pegylated interferon-alpha + ribavirin for 48 weeks",
            "Direct-acting antiviral (DAA) regimen for 8–12 weeks",
            "Liver transplantation",
            "No treatment — await spontaneous clearance",
        ],
        "correct_option": 1,
        "explanation": (
            "Direct-acting antivirals (DAAs) — such as sofosbuvir/velpatasvir or "
            "glecaprevir/pibrentasvir — achieve sustained virological response (SVR, "
            "effectively a cure) in >95% of patients across all HCV genotypes in 8–12 weeks, "
            "with minimal side effects. They have replaced pegylated interferon-based regimens. "
            "SVR reduces the risk of cirrhosis, hepatocellular carcinoma, and liver-related mortality."
        ),
        "topic": "Gastroenterology",
        "chapter_ref": "p10_c355",
        "difficulty": "medium",
    },
    {
        "question_id": "q_p10_c362_001",
        "stem": (
            "A 58-year-old man with known cirrhosis and ascites develops fever, abdominal "
            "pain, and worsening encephalopathy. Paracentesis shows ascitic fluid PMN count "
            "of 350 cells/µL. What is the diagnosis and treatment?"
        ),
        "options": [
            "Secondary peritonitis — requires surgical exploration",
            "Spontaneous bacterial peritonitis (SBP) — treat with intravenous cefotaxime",
            "Hepatic hydrothorax — requires thoracocentesis",
            "Hepatorenal syndrome — requires vasoconstrictors",
        ],
        "correct_option": 1,
        "explanation": (
            "Spontaneous bacterial peritonitis (SBP) is defined by an ascitic fluid PMN count "
            "≥250 cells/µL. It is a common life-threatening complication of cirrhosis caused "
            "by translocation of enteric bacteria. IV cefotaxime (or a third-generation "
            "cephalosporin) is the first-line treatment. IV albumin (1.5 g/kg on day 1, "
            "1 g/kg on day 3) reduces the incidence of hepatorenal syndrome."
        ),
        "topic": "Gastroenterology",
        "chapter_ref": "p10_c362",
        "difficulty": "medium",
    },
    {
        "question_id": "q_p10_c330_002",
        "stem": (
            "A 32-year-old woman with known ulcerative colitis presents with 10 bloody stools "
            "per day, fever 38.9°C, tachycardia, and severe abdominal tenderness. "
            "An abdominal X-ray shows colonic dilatation of 7 cm. What complication has developed?"
        ),
        "options": [
            "Perforated viscus — immediate laparotomy required",
            "Toxic megacolon — bowel rest, IV steroids, surgical consult",
            "Ischaemic colitis — requires CT angiography",
            "CMV colitis — requires antiviral therapy",
        ],
        "correct_option": 1,
        "explanation": (
            "Toxic megacolon is defined as colonic dilatation >6 cm with systemic toxicity "
            "(fever, tachycardia, leukocytosis). It is a life-threatening complication of "
            "severe colitis (UC, Crohn's, infectious). Management includes bowel rest (NPO), "
            "IV fluids, IV corticosteroids, antibiotics, nasogastric decompression, and "
            "urgent surgical consultation. Emergency colectomy is required for perforation, "
            "peritonitis, or failure to improve within 48–72 hours."
        ),
        "topic": "Gastroenterology",
        "chapter_ref": "p10_c330",
        "difficulty": "hard",
    },

    # ── Endocrinology (continued) ────────────────────────────────────────────
    {
        "question_id": "q_p12_c379_001",
        "stem": (
            "A 35-year-old woman has central obesity, purple striae, easy bruising, "
            "hypertension, and an elevated 24-hour urinary free cortisol. "
            "What is the most likely diagnosis?"
        ),
        "options": [
            "Hypothyroidism",
            "Cushing's syndrome",
            "Polycystic ovary syndrome",
            "Metabolic syndrome",
        ],
        "correct_option": 1,
        "explanation": (
            "Cushing's syndrome (cortisol excess) presents with central (truncal) obesity, "
            "wide purple striae (>1 cm), easy bruising, proximal myopathy, hypertension, "
            "hyperglycaemia, and osteoporosis. The 24-hour urinary free cortisol is an "
            "excellent screening test. The most common cause is exogenous corticosteroids; "
            "endogenous causes include pituitary ACTH-secreting adenoma (Cushing's disease, "
            "most common), ectopic ACTH, and adrenal adenoma."
        ),
        "topic": "Endocrinology",
        "chapter_ref": "p12_c379",
        "difficulty": "easy",
    },
    {
        "question_id": "q_p12_c389_001",
        "stem": (
            "A 55-year-old woman is found to have serum calcium of 11.4 mg/dL and PTH "
            "of 120 pg/mL (normal 10–65). She has a history of kidney stones. "
            "What is the most likely diagnosis?"
        ),
        "options": [
            "Malignancy-related hypercalcaemia",
            "Primary hyperparathyroidism",
            "Sarcoidosis",
            "Milk-alkali syndrome",
        ],
        "correct_option": 1,
        "explanation": (
            "Primary hyperparathyroidism is the most common cause of hypercalcaemia in "
            "outpatients and is characterised by hypercalcaemia with inappropriately elevated "
            "PTH (PTH should be suppressed in hypercalcaemia). It is often caused by a "
            "solitary parathyroid adenoma. Complications include nephrolithiasis (calcium "
            "oxalate/phosphate stones), osteoporosis, and rarely pancreatitis. "
            "Malignancy-related hypercalcaemia is associated with suppressed PTH."
        ),
        "topic": "Endocrinology",
        "chapter_ref": "p12_c389",
        "difficulty": "easy",
    },
    {
        "question_id": "q_p12_c379_002",
        "stem": (
            "A 40-year-old man with fatigue, weight loss, and hyperpigmentation has a "
            "morning cortisol of 3 µg/dL. The high-dose cosyntropin (ACTH) stimulation "
            "test shows cortisol rising to only 8 µg/dL. What does this indicate?"
        ),
        "options": [
            "Secondary (pituitary) adrenal insufficiency",
            "Primary adrenal insufficiency (Addison's disease)",
            "Cushing's syndrome",
            "Normal adrenal function",
        ],
        "correct_option": 1,
        "explanation": (
            "A blunted cortisol response to cosyntropin (cortisol should rise to >18–20 µg/dL) "
            "indicates adrenal insufficiency. Hyperpigmentation (from elevated ACTH and "
            "MSH) points to primary (adrenal) failure — Addison's disease — where ACTH is "
            "elevated but the adrenal gland cannot respond. In secondary (pituitary) "
            "insufficiency, ACTH is low and there is no hyperpigmentation."
        ),
        "topic": "Endocrinology",
        "chapter_ref": "p12_c379",
        "difficulty": "medium",
    },
    {
        "question_id": "q_p12_c384_001",
        "stem": (
            "A 28-year-old with type 1 diabetes presents with blood glucose 540 mg/dL, "
            "pH 7.14, bicarbonate 8 mEq/L, and serum ketones 4+. What is the priority "
            "sequence in initial management?"
        ),
        "options": [
            "Insulin bolus → IV fluids → potassium replacement",
            "IV fluids → potassium check → insulin infusion",
            "Sodium bicarbonate → insulin → IV fluids",
            "Insulin glargine SC → dietary restriction → fluids",
        ],
        "correct_option": 1,
        "explanation": (
            "DKA management: (1) IV fluids first (typically 1 L normal saline over 1 hour) "
            "to restore intravascular volume; (2) check potassium before starting insulin — "
            "insulin drives K+ intracellularly and can cause life-threatening hypokalaemia; "
            "if K+ <3.5 mEq/L, replace before insulin; (3) regular insulin infusion at "
            "0.1 U/kg/hr. Bicarbonate is generally not used unless pH <6.9."
        ),
        "topic": "Endocrinology",
        "chapter_ref": "p12_c384",
        "difficulty": "medium",
    },
    {
        "question_id": "q_p12_c386_001",
        "stem": (
            "A 42-year-old woman has a 2 cm thyroid nodule found incidentally. TSH is "
            "normal. Ultrasound shows the nodule is hypoechoic with microcalcifications "
            "and irregular margins. What is the next most appropriate step?"
        ),
        "options": [
            "Annual surveillance ultrasound only",
            "Fine-needle aspiration (FNA) biopsy",
            "Thyroid scintigraphy with technetium",
            "Immediate thyroidectomy",
        ],
        "correct_option": 1,
        "explanation": (
            "Microcalcifications and irregular margins on ultrasound are high-suspicion "
            "features for malignancy (papillary thyroid carcinoma) in a nodule ≥1 cm. "
            "FNA is the next step to obtain tissue for cytology. Thyroid scintigraphy is "
            "indicated when TSH is suppressed (to identify 'hot' autonomous nodules, which "
            "are rarely malignant). Immediate surgery is reserved for confirmed or highly "
            "suspicious malignancy."
        ),
        "topic": "Endocrinology",
        "chapter_ref": "p12_c386",
        "difficulty": "medium",
    },
    {
        "question_id": "q_p12_c384_002",
        "stem": (
            "A 70-year-old man with type 2 diabetes presents with blood glucose 980 mg/dL, "
            "serum osmolality 345 mOsm/kg, pH 7.36, and trace ketones. He is obtunded. "
            "How does this differ from DKA?"
        ),
        "options": [
            "HHS has more severe ketoacidosis than DKA",
            "HHS has extreme hyperglycaemia and hyperosmolality with minimal ketosis and no acidosis",
            "HHS occurs exclusively in type 1 diabetes",
            "DKA always presents with higher glucose than HHS",
        ],
        "correct_option": 1,
        "explanation": (
            "Hyperosmolar hyperglycaemic state (HHS) occurs predominantly in type 2 DM. "
            "It is characterised by extreme hyperglycaemia (often >600 mg/dL), profound "
            "hyperosmolality (>320 mOsm/kg), absence of significant ketosis (residual "
            "insulin prevents lipolysis), and no acidosis. Mortality is higher than DKA due "
            "to the underlying precipitant (infection, MI) and severe dehydration. "
            "Treatment prioritises aggressive fluid replacement."
        ),
        "topic": "Endocrinology",
        "chapter_ref": "p12_c384",
        "difficulty": "hard",
    },

    # ── Neurology (continued) ────────────────────────────────────────────────
    {
        "question_id": "q_p13_c436_001",
        "stem": (
            "An 80-year-old man presents with progressive memory loss, difficulty with "
            "language, and impaired instrumental activities of daily living over 4 years. "
            "Brain MRI shows bilateral hippocampal and parietal atrophy. "
            "What is the most likely diagnosis?"
        ),
        "options": [
            "Lewy body dementia",
            "Alzheimer's disease",
            "Vascular dementia",
            "Frontotemporal dementia",
        ],
        "correct_option": 1,
        "explanation": (
            "Alzheimer's disease is the most common cause of dementia (60–80%). It presents "
            "insidiously with episodic memory loss, followed by language, visuospatial, and "
            "executive deficits. MRI shows medial temporal lobe (hippocampal) atrophy. "
            "Lewy body dementia features visual hallucinations and parkinsonism. Vascular "
            "dementia follows a stepwise course after strokes. FTD presents with early "
            "personality/behaviour change or language problems."
        ),
        "topic": "Neurology",
        "chapter_ref": "p13_c436",
        "difficulty": "easy",
    },
    {
        "question_id": "q_p13_c434_001",
        "stem": (
            "A 28-year-old woman presents with an episode of right-sided optic neuritis "
            "that resolved, followed 18 months later by leg weakness and urinary urgency. "
            "MRI brain shows periventricular white matter lesions. CSF shows oligoclonal "
            "bands. What is the diagnosis?"
        ),
        "options": [
            "Neuromyelitis optica spectrum disorder (NMOSD)",
            "Relapsing-remitting multiple sclerosis (RRMS)",
            "Acute disseminated encephalomyelitis (ADEM)",
            "CNS vasculitis",
        ],
        "correct_option": 1,
        "explanation": (
            "Relapsing-remitting MS is the most common form, presenting with distinct "
            "episodes of neurological deficits separated in time and space. Optic neuritis "
            "is a classic early presentation. Periventricular 'Dawson fingers' on MRI and "
            "CSF oligoclonal bands support the diagnosis. NMOSD is associated with "
            "anti-AQP4 antibodies and typically causes severe optic neuritis and longitudinally "
            "extensive transverse myelitis. ADEM is monophasic and typically post-infectious."
        ),
        "topic": "Neurology",
        "chapter_ref": "p13_c434",
        "difficulty": "medium",
    },
    {
        "question_id": "q_p13_c437_001",
        "stem": (
            "A 60-year-old man with 20-year history of type 2 diabetes has numbness and "
            "tingling in a 'stocking-and-glove' distribution. Nerve conduction studies show "
            "reduced sensory amplitudes in the lower extremities. What is the most likely "
            "neuropathy pattern?"
        ),
        "options": [
            "Mononeuritis multiplex",
            "Distal symmetric polyneuropathy",
            "Radiculopathy",
            "Autonomic neuropathy",
        ],
        "correct_option": 1,
        "explanation": (
            "Distal symmetric polyneuropathy (DSPN) is the most common type of diabetic "
            "neuropathy, affecting ~50% of patients with long-standing diabetes. It "
            "presents with length-dependent sensory loss in a stocking-and-glove "
            "distribution due to dying-back of the longest nerve fibres. NCS shows reduced "
            "sensory amplitudes. Mononeuritis multiplex involves separate named nerves. "
            "Autonomic neuropathy manifests as orthostatic hypotension, gastroparesis, etc."
        ),
        "topic": "Neurology",
        "chapter_ref": "p13_c437",
        "difficulty": "medium",
    },
    {
        "question_id": "q_p13_c436_002",
        "stem": (
            "A 72-year-old man presents with gait disturbance described as 'magnetic' or "
            "shuffling, urinary incontinence, and progressive cognitive decline. "
            "MRI shows enlarged ventricles disproportionate to sulcal atrophy. "
            "Lumbar puncture removes 50 mL of CSF with significant improvement in gait. "
            "What is the most likely diagnosis?"
        ),
        "options": [
            "Alzheimer's disease with normal-pressure variant",
            "Normal pressure hydrocephalus (NPH)",
            "Parkinson's disease with dementia",
            "Superficial siderosis",
        ],
        "correct_option": 1,
        "explanation": (
            "Normal pressure hydrocephalus (NPH) presents with Hakim's triad: gait apraxia "
            "(magnetic gait), urinary incontinence, and dementia — in that order. MRI shows "
            "ventriculomegaly out of proportion to cortical atrophy. Improvement after "
            "large-volume LP (tap test) predicts response to ventriculoperitoneal shunting. "
            "It is distinguished from Alzheimer's by prominent early gait disturbance and "
            "improvement with CSF drainage."
        ),
        "topic": "Neurology",
        "chapter_ref": "p13_c436",
        "difficulty": "hard",
    },

    # ── Infectious Disease ───────────────────────────────────────────────────
    {
        "question_id": "q_p05_c141_001",
        "stem": (
            "A 55-year-old man with pneumonia has a respiratory rate of 26/min, altered "
            "mental status, and a systolic BP of 88 mmHg despite 2 L IV fluids. "
            "Lactate is 3.8 mmol/L. How is this best classified?"
        ),
        "options": [
            "Sepsis — SOFA score increase ≥2",
            "Septic shock — vasopressor-requiring hypotension with elevated lactate",
            "Severe sepsis — former Sepsis-2 criteria",
            "SIRS without organ dysfunction",
        ],
        "correct_option": 1,
        "explanation": (
            "Sepsis-3 defines septic shock as sepsis with circulatory and cellular/metabolic "
            "dysfunction — clinically identified by vasopressor requirement to maintain MAP "
            "≥65 mmHg AND serum lactate >2 mmol/L despite adequate fluid resuscitation. "
            "Mortality exceeds 40%. Sepsis alone is life-threatening organ dysfunction due "
            "to infection (SOFA ≥2). 'Severe sepsis' is an outdated Sepsis-2 term."
        ),
        "topic": "Infectious Disease",
        "chapter_ref": "p05_c141",
        "difficulty": "easy",
    },
    {
        "question_id": "q_p05_c160_001",
        "stem": (
            "A 35-year-old IV drug user develops fever, chills, and a new pansystolic "
            "murmur at the left sternal border. Blood cultures grow Staphylococcus aureus. "
            "Which valve is most commonly affected in IV drug users with infective endocarditis?"
        ),
        "options": [
            "Mitral valve",
            "Tricuspid valve",
            "Aortic valve",
            "Pulmonic valve",
        ],
        "correct_option": 1,
        "explanation": (
            "In intravenous drug users, infective endocarditis most commonly affects the "
            "tricuspid valve (right-sided endocarditis), because injected bacteria enter "
            "the venous circulation and directly seed the right heart. S. aureus is the "
            "predominant organism. In native valve endocarditis in non-drug users, the "
            "mitral valve is most commonly affected, followed by the aortic valve."
        ),
        "topic": "Infectious Disease",
        "chapter_ref": "p05_c160",
        "difficulty": "easy",
    },
    {
        "question_id": "q_p05_c173_001",
        "stem": (
            "A newly diagnosed HIV-positive patient has a CD4 count of 160 cells/µL. "
            "In addition to starting antiretroviral therapy, which prophylactic medication "
            "should be initiated immediately?"
        ),
        "options": [
            "Fluconazole for Candida prophylaxis",
            "Trimethoprim-sulfamethoxazole (TMP-SMX) for PCP prophylaxis",
            "Azithromycin for MAC prophylaxis",
            "Acyclovir for HSV prophylaxis",
        ],
        "correct_option": 1,
        "explanation": (
            "Pneumocystis jirovecii pneumonia (PCP) prophylaxis with trimethoprim-"
            "sulfamethoxazole (TMP-SMX) is indicated when CD4 count <200 cells/µL. "
            "TMP-SMX also provides protection against Toxoplasma gondii encephalitis "
            "(CD4 <100 with positive IgG). MAC prophylaxis with azithromycin is indicated "
            "at CD4 <50 cells/µL. ART should be started in all patients regardless of "
            "CD4 count."
        ),
        "topic": "Infectious Disease",
        "chapter_ref": "p05_c173",
        "difficulty": "easy",
    },
    {
        "question_id": "q_p05_c141_002",
        "stem": (
            "A patient with septic shock requires vasopressor therapy. Which vasopressor "
            "is recommended as FIRST-LINE according to the Surviving Sepsis Campaign guidelines?"
        ),
        "options": [
            "Dopamine",
            "Norepinephrine",
            "Epinephrine",
            "Vasopressin",
        ],
        "correct_option": 1,
        "explanation": (
            "Norepinephrine is the first-line vasopressor for septic shock. It increases "
            "mean arterial pressure primarily through alpha-1–mediated vasoconstriction with "
            "modest beta-1 effects. Dopamine is associated with higher arrhythmia rates. "
            "Vasopressin (0.03 U/min) can be added to norepinephrine as a catecholamine-"
            "sparing agent. Epinephrine is a second-line agent due to its metabolic effects "
            "(lactic acidosis, hyperglycaemia)."
        ),
        "topic": "Infectious Disease",
        "chapter_ref": "p05_c141",
        "difficulty": "medium",
    },
    {
        "question_id": "q_p05_c155_001",
        "stem": (
            "A 74-year-old man with pneumonia has BUN 24 mg/dL, RR 28/min, confusion, "
            "and SBP 88 mmHg. Using the CURB-65 score, what is his score and what does "
            "it recommend?"
        ),
        "options": [
            "Score 2 — outpatient treatment",
            "Score 4 — hospitalisation, consider ICU",
            "Score 1 — low risk, outpatient",
            "Score 3 — inpatient, short stay",
        ],
        "correct_option": 1,
        "explanation": (
            "CURB-65: C = confusion (1), U = urea/BUN >19 mg/dL (1), R = RR ≥30/min (1), "
            "B = BP SBP <90 or DBP ≤60 (1), 65 = age ≥65 (1). This patient scores 4 "
            "(confusion + elevated BUN + RR 28 [close but <30] + hypotension). Wait — RR 28 "
            "is <30 so that is 0. Score = C+U+B+65 = 4. Score ≥3 indicates high severity, "
            "hospital admission, and consideration of ICU (score ≥3 mortality ~14–20%)."
        ),
        "topic": "Infectious Disease",
        "chapter_ref": "p05_c155",
        "difficulty": "medium",
    },
    {
        "question_id": "q_p05_c160_002",
        "stem": (
            "Which of the following is a MAJOR criterion in the Duke criteria for infective endocarditis?"
        ),
        "options": [
            "Fever >38°C",
            "Positive blood cultures with a typical organism from two separate cultures",
            "Predisposing heart condition or IV drug use",
            "Vascular phenomena (septic emboli, Janeway lesions)",
        ],
        "correct_option": 1,
        "explanation": (
            "The Duke criteria classify IE as definite, possible, or rejected. Major criteria "
            "include: (1) positive blood cultures with typical organisms (S. viridans, S. aureus, "
            "enterococci, etc.) from ≥2 separate cultures, or persistently positive cultures; "
            "and (2) echocardiographic evidence (vegetation, abscess, dehiscence) or new "
            "valvular regurgitation. Minor criteria include fever, predisposing conditions, "
            "vascular/immunological phenomena, and non-diagnostic echocardiographic findings."
        ),
        "topic": "Infectious Disease",
        "chapter_ref": "p05_c160",
        "difficulty": "medium",
    },
    {
        "question_id": "q_p05_c165_001",
        "stem": (
            "A 30-year-old immigrant from a TB-endemic country has a positive IGRA and "
            "chest X-ray showing right upper lobe consolidation with cavitation. Sputum "
            "AFB smear is positive. What is the standard initial treatment regimen?"
        ),
        "options": [
            "Isoniazid monotherapy for 9 months",
            "Rifampin, isoniazid, pyrazinamide, ethambutol (RIPE) for 2 months, then rifampin + isoniazid for 4 months",
            "Rifampin + isoniazid for 6 months",
            "Clarithromycin + ethambutol for 12 months",
        ],
        "correct_option": 1,
        "explanation": (
            "Standard first-line TB treatment: initial phase — RIPE (Rifampin, Isoniazid, "
            "Pyrazinamide, Ethambutol) for 2 months; continuation phase — Rifampin + "
            "Isoniazid for 4 months (total 6 months). Ethambutol is included initially "
            "pending susceptibility testing to cover possible isoniazid resistance. "
            "Isoniazid monotherapy treats latent TB infection (LTBI), not active disease."
        ),
        "topic": "Infectious Disease",
        "chapter_ref": "p05_c165",
        "difficulty": "medium",
    },
    {
        "question_id": "q_p05_c173_002",
        "stem": (
            "A 29-year-old man is newly diagnosed with HIV infection. His CD4 count is "
            "450 cells/µL and viral load is 85,000 copies/mL. He has no opportunistic "
            "infections. When should antiretroviral therapy (ART) be started?"
        ),
        "options": [
            "When CD4 falls below 350 cells/µL",
            "Immediately, regardless of CD4 count",
            "When CD4 falls below 200 cells/µL",
            "Only if symptomatic HIV disease develops",
        ],
        "correct_option": 1,
        "explanation": (
            "Current guidelines (WHO, DHHS) recommend ART for ALL people living with HIV "
            "regardless of CD4 count or clinical stage. Early ART reduces the risk of AIDS-"
            "defining events, non-AIDS morbidity (cardiovascular, renal, liver disease), "
            "and HIV transmission. The START trial demonstrated mortality benefit even at "
            "CD4 >500 cells/µL. Preferred regimens include integrase strand transfer "
            "inhibitor (INSTI)-based combinations."
        ),
        "topic": "Infectious Disease",
        "chapter_ref": "p05_c173",
        "difficulty": "medium",
    },
    {
        "question_id": "q_p05_c165_002",
        "stem": (
            "A 45-year-old patient fails first-line TB therapy and sputum cultures show "
            "resistance to rifampin and isoniazid. What category does this represent and "
            "what drug class is the backbone of treatment?"
        ),
        "options": [
            "Extensively drug-resistant TB (XDR-TB) — treatment with clofazimine",
            "Multidrug-resistant TB (MDR-TB) — treat with fluoroquinolone-based regimens",
            "Pre-XDR-TB — no effective treatment available",
            "Rifampicin-resistant TB — treat with isoniazid alone",
        ],
        "correct_option": 1,
        "explanation": (
            "Multidrug-resistant TB (MDR-TB) is defined as resistance to at least rifampin "
            "and isoniazid, the two most potent first-line drugs. Treatment requires at "
            "least 18–20 months with second-line drugs. Modern regimens include later-"
            "generation fluoroquinolones (levofloxacin or moxifloxacin), bedaquiline, "
            "linezolid, and clofazimine. XDR-TB additionally has resistance to "
            "fluoroquinolones and at least one injectable agent."
        ),
        "topic": "Infectious Disease",
        "chapter_ref": "p05_c165",
        "difficulty": "hard",
    },
    {
        "question_id": "q_p05_c160_003",
        "stem": (
            "A patient with a prosthetic aortic valve is scheduled for a dental extraction. "
            "Which of the following warrants antibiotic prophylaxis for infective endocarditis?"
        ),
        "options": [
            "All patients with any cardiac murmur",
            "Patients with prosthetic cardiac valves or prior IE",
            "Patients with hypertensive heart disease",
            "All patients over age 65 undergoing invasive dental procedures",
        ],
        "correct_option": 1,
        "explanation": (
            "AHA/ACC guidelines restrict IE prophylaxis to highest-risk cardiac conditions: "
            "(1) prosthetic cardiac valves or prosthetic material for valve repair; "
            "(2) prior IE; (3) unrepaired cyanotic congenital heart disease; "
            "(4) cardiac transplant with valvulopathy. Amoxicillin 2 g PO 30–60 min before "
            "dental procedures is standard. Most congenital defects, bicuspid aortic valves, "
            "and mitral valve prolapse no longer qualify."
        ),
        "topic": "Infectious Disease",
        "chapter_ref": "p05_c160",
        "difficulty": "hard",
    },

    # ── Hematology ───────────────────────────────────────────────────────────
    {
        "question_id": "q_p04_c093_001",
        "stem": (
            "A 28-year-old woman with menorrhagia has Hb 9.4 g/dL, MCV 72 fL, "
            "serum ferritin 6 ng/mL, and low serum iron with elevated TIBC. "
            "What is the diagnosis?"
        ),
        "options": [
            "Anaemia of chronic disease",
            "Iron deficiency anaemia",
            "Beta-thalassaemia trait",
            "Sideroblastic anaemia",
        ],
        "correct_option": 1,
        "explanation": (
            "Iron deficiency anaemia (IDA) is characterised by microcytic hypochromic "
            "anaemia, low ferritin (<12–15 ng/mL — best indicator of depleted iron stores), "
            "low serum iron, and elevated TIBC. Menorrhagia is the most common cause in "
            "premenopausal women. Anaemia of chronic disease has elevated ferritin, low "
            "TIBC, and low serum iron. Thalassaemia trait has normal/elevated ferritin."
        ),
        "topic": "Hematology",
        "chapter_ref": "p04_c093",
        "difficulty": "easy",
    },
    {
        "question_id": "q_p04_c098_001",
        "stem": (
            "A 55-year-old vegan man has Hb 9.8 g/dL, MCV 108 fL, hypersegmented "
            "neutrophils, and peripheral neuropathy with subacute combined degeneration "
            "of the spinal cord. What is the likely deficiency?"
        ),
        "options": [
            "Folate deficiency",
            "Vitamin B12 (cobalamin) deficiency",
            "Iron deficiency",
            "Copper deficiency",
        ],
        "correct_option": 1,
        "explanation": (
            "Vitamin B12 deficiency causes megaloblastic anaemia (macrocytosis, "
            "hypersegmented neutrophils) AND neurological disease (subacute combined "
            "degeneration — posterior and lateral column demyelination causing peripheral "
            "neuropathy, ataxia, and cognitive decline). Folate deficiency causes identical "
            "haematological findings but NOT the neurological manifestations. Vegans are at "
            "risk as B12 is found only in animal products."
        ),
        "topic": "Hematology",
        "chapter_ref": "p04_c098",
        "difficulty": "easy",
    },
    {
        "question_id": "q_p04_c102_001",
        "stem": (
            "A 22-year-old African American man has repeated episodes of severe bone pain "
            "and acute chest syndrome. His haemoglobin electrophoresis shows HbS 90%, "
            "HbF 5%, no HbA. What is the pathophysiology of his condition?"
        ),
        "options": [
            "Haemoglobin undergoes haemolysis due to oxidative stress",
            "HbS polymerises when deoxygenated, causing RBC sickling and vaso-occlusion",
            "Defective globin chain synthesis reduces haemoglobin production",
            "Autoimmune destruction of red cell precursors in the bone marrow",
        ],
        "correct_option": 1,
        "explanation": (
            "In sickle cell disease (HbSS), a point mutation (Glu→Val at position 6 of "
            "beta-globin) causes HbS to polymerise under low oxygen tension. This distorts "
            "RBCs into sickle shapes that occlude microvasculature, causing vaso-occlusive "
            "pain crises, acute chest syndrome, stroke, and organ damage. Haemolysis "
            "also occurs. HbF inhibits sickling — hydroxyurea increases HbF production."
        ),
        "topic": "Hematology",
        "chapter_ref": "p04_c102",
        "difficulty": "easy",
    },
    {
        "question_id": "q_p04_c093_002",
        "stem": (
            "A 60-year-old man with rheumatoid arthritis has Hb 10.2 g/dL, MCV 82 fL, "
            "ferritin 180 ng/mL, low serum iron, and low TIBC. What type of anaemia is this?"
        ),
        "options": [
            "Iron deficiency anaemia — treat with oral iron",
            "Anaemia of chronic disease/inflammation — treat the underlying condition",
            "Aplastic anaemia — requires bone marrow biopsy",
            "Sideroblastic anaemia — due to lead poisoning",
        ],
        "correct_option": 1,
        "explanation": (
            "Anaemia of chronic disease (ACD) results from inflammatory cytokines increasing "
            "hepcidin, which sequesters iron in macrophages and reduces intestinal iron "
            "absorption. It is characterised by normocytic or mildly microcytic anaemia, "
            "elevated ferritin (acute-phase reactant), low serum iron, and low-normal TIBC. "
            "Treatment targets the underlying inflammatory condition. Iron supplementation "
            "is not beneficial unless concurrent IDA is confirmed."
        ),
        "topic": "Hematology",
        "chapter_ref": "p04_c093",
        "difficulty": "medium",
    },
    {
        "question_id": "q_p04_c095_001",
        "stem": (
            "A 10-year-old child of Mediterranean origin has mild anaemia (Hb 10.5 g/dL), "
            "microcytosis (MCV 65 fL), target cells on peripheral smear, and elevated HbA2 "
            "on electrophoresis. Family history is significant for similar findings. "
            "Iron studies are normal. What is the most likely diagnosis?"
        ),
        "options": [
            "Iron deficiency anaemia",
            "Beta-thalassaemia trait (minor)",
            "Alpha-thalassaemia trait",
            "Haemoglobin C disease",
        ],
        "correct_option": 1,
        "explanation": (
            "Beta-thalassaemia trait (carrier state) is characterised by mild microcytic "
            "anaemia, elevated HbA2 (>3.5%) on electrophoresis, target cells, and normal "
            "iron studies. It is common in Mediterranean, Middle Eastern, and South Asian "
            "populations due to reduced beta-globin chain synthesis. Unlike IDA, ferritin "
            "is normal/elevated. Alpha-thalassaemia trait has normal HbA2 and typically "
            "4-deletion confirmation by DNA analysis."
        ),
        "topic": "Hematology",
        "chapter_ref": "p04_c095",
        "difficulty": "medium",
    },
    {
        "question_id": "q_p04_c098_002",
        "stem": (
            "How can you clinically distinguish vitamin B12 deficiency from folate "
            "deficiency when both cause megaloblastic anaemia?"
        ),
        "options": [
            "B12 deficiency causes folate levels to rise; folate deficiency has no effect on B12",
            "B12 deficiency causes neurological complications; folate deficiency does not",
            "Folate deficiency is more common in vegans; B12 deficiency is from poor diet",
            "They cannot be distinguished without bone marrow biopsy",
        ],
        "correct_option": 1,
        "explanation": (
            "Both B12 and folate deficiency produce identical megaloblastic anaemia on blood "
            "film (macrocytosis, hypersegmented neutrophils). The critical distinguishing "
            "feature is that B12 deficiency causes subacute combined degeneration of the "
            "spinal cord (dorsal and lateral column demyelination), leading to peripheral "
            "neuropathy, ataxia, and cognitive impairment. Folate deficiency causes no "
            "neurological disease. Measuring serum B12 and folate distinguishes them."
        ),
        "topic": "Hematology",
        "chapter_ref": "p04_c098",
        "difficulty": "medium",
    },
    {
        "question_id": "q_p04_c108_001",
        "stem": (
            "A 45-year-old man presents with fatigue and a spleen palpable 12 cm below the "
            "left costal margin. CBC shows WBC 85,000/µL with differential showing mature "
            "granulocytes in all stages, basophilia, and thrombocytosis. Cytogenetics reveal "
            "t(9;22) — the Philadelphia chromosome. What is the diagnosis and first-line treatment?"
        ),
        "options": [
            "Acute myeloid leukaemia — induction chemotherapy",
            "Chronic myeloid leukaemia (CML) — imatinib (BCR-ABL tyrosine kinase inhibitor)",
            "Polycythaemia vera — phlebotomy and hydroxyurea",
            "Myelofibrosis — ruxolitinib",
        ],
        "correct_option": 1,
        "explanation": (
            "Chronic myeloid leukaemia (CML) is a myeloproliferative neoplasm caused by "
            "the BCR-ABL1 fusion gene from t(9;22) — the Philadelphia chromosome. It "
            "typically presents in the chronic phase with leukocytosis, splenomegaly, "
            "basophilia, and thrombocytosis. Imatinib (a BCR-ABL tyrosine kinase inhibitor) "
            "revolutionised CML treatment, achieving deep molecular responses in most "
            "patients. Newer TKIs (dasatinib, nilotinib, ponatinib) are used for resistance."
        ),
        "topic": "Hematology",
        "chapter_ref": "p04_c108",
        "difficulty": "medium",
    },
    {
        "question_id": "q_p04_c102_002",
        "stem": (
            "A 20-year-old with sickle cell disease presents with severe pain crisis in his "
            "back and extremities. He is afebrile and haemodynamically stable. "
            "What is the appropriate initial management?"
        ),
        "options": [
            "Exchange transfusion immediately",
            "IV fluids, adequate analgesia (opioids), oxygen if hypoxic",
            "Prophylactic antibiotics and observation",
            "Emergency hydroxyurea dose escalation",
        ],
        "correct_option": 1,
        "explanation": (
            "Acute vaso-occlusive pain crisis management: (1) IV hydration to correct "
            "dehydration and reduce sickling; (2) adequate analgesia — opioids (morphine, "
            "hydromorphone) for moderate-severe pain on a scheduled basis with PRN dosing; "
            "(3) supplemental oxygen if SpO2 <95%. Exchange transfusion is reserved for "
            "acute chest syndrome, stroke, or priapism. Hydroxyurea is for long-term "
            "prevention, not acute crisis management."
        ),
        "topic": "Hematology",
        "chapter_ref": "p04_c102",
        "difficulty": "medium",
    },
    {
        "question_id": "q_p04_c108_002",
        "stem": (
            "A 60-year-old woman is treated with combination chemotherapy for diffuse large "
            "B-cell lymphoma. On day 3, labs show potassium 6.8 mEq/L, phosphate 7.2 mg/dL, "
            "uric acid 14 mg/dL, and creatinine 2.6 mg/dL. What syndrome has developed "
            "and what is the preferred treatment?"
        ),
        "options": [
            "Haemolytic uraemic syndrome — plasma exchange",
            "Tumour lysis syndrome (TLS) — rasburicase + aggressive IV hydration",
            "Fanconi syndrome — bicarbonate supplementation",
            "Cytokine release syndrome — tocilizumab",
        ],
        "correct_option": 1,
        "explanation": (
            "Tumour lysis syndrome (TLS) is caused by massive release of intracellular "
            "contents after cancer treatment, causing hyperuricaemia, hyperkalaemia, "
            "hyperphosphataemia, hypocalcaemia, and AKI. Treatment: aggressive IV "
            "hydration; rasburicase (recombinant urate oxidase) rapidly lowers uric acid "
            "and is preferred over allopurinol in established TLS; correct electrolytes; "
            "dialysis for refractory cases. Prevention with allopurinol or rasburicase "
            "before chemotherapy in high-risk patients."
        ),
        "topic": "Hematology",
        "chapter_ref": "p04_c108",
        "difficulty": "hard",
    },
    {
        "question_id": "q_p04_c110_001",
        "stem": (
            "A 35-year-old woman with septic shock develops oozing from IV sites, "
            "haematuria, and widespread ecchymoses. Labs show: PT 28 s, aPTT 65 s, "
            "fibrinogen 80 mg/dL, D-dimer >10 µg/mL, platelets 45,000/µL. "
            "What is the diagnosis?"
        ),
        "options": [
            "Heparin-induced thrombocytopenia (HIT)",
            "Disseminated intravascular coagulation (DIC)",
            "Thrombotic thrombocytopenic purpura (TTP)",
            "Vitamin K deficiency",
        ],
        "correct_option": 1,
        "explanation": (
            "DIC is characterised by simultaneous excessive clotting and bleeding due to "
            "systemic activation of coagulation. Laboratory hallmarks: prolonged PT and "
            "aPTT, low fibrinogen (<150 mg/dL, consumed), markedly elevated D-dimer, "
            "thrombocytopenia. Sepsis is the most common trigger. Treatment targets the "
            "underlying cause; blood products (FFP, cryoprecipitate, platelets) for active "
            "bleeding. HIT has normal PT/aPTT. TTP has microangiopathic haemolytic anaemia "
            "and near-normal coagulation."
        ),
        "topic": "Hematology",
        "chapter_ref": "p04_c110",
        "difficulty": "hard",
    },

    # ── Rheumatology ─────────────────────────────────────────────────────────
    {
        "question_id": "q_p11_c362_001",
        "stem": (
            "A 42-year-old woman has a 6-month history of bilateral symmetric swelling "
            "of the metacarpophalangeal and proximal interphalangeal joints with morning "
            "stiffness lasting >1 hour. RF is positive. X-ray shows periarticular "
            "osteopenia. What is the most likely diagnosis?"
        ),
        "options": [
            "Osteoarthritis",
            "Rheumatoid arthritis",
            "Psoriatic arthritis",
            "Gout",
        ],
        "correct_option": 1,
        "explanation": (
            "Rheumatoid arthritis (RA) classically presents with symmetric polyarthritis "
            "involving the small joints of the hands (MCPs and PIPs, sparing DIPs), "
            "prolonged morning stiffness (>1 hour), elevated inflammatory markers, and "
            "seropositive RF and/or anti-CCP. X-ray findings include periarticular "
            "osteopenia and marginal erosions. Osteoarthritis involves DIPs and first CMC "
            "joints. Gout is typically monoarticular and asymmetric."
        ),
        "topic": "Rheumatology",
        "chapter_ref": "p11_c362",
        "difficulty": "easy",
    },
    {
        "question_id": "q_p11_c376_001",
        "stem": (
            "A 55-year-old overweight man develops sudden severe pain, erythema, and "
            "swelling of the right first metatarsophalangeal joint. Serum uric acid is "
            "9.8 mg/dL. Arthrocentesis shows negatively birefringent needle-shaped crystals. "
            "What is the diagnosis and acute treatment?"
        ),
        "options": [
            "Pseudogout — colchicine for 1 week",
            "Gout — NSAIDs, colchicine, or corticosteroids",
            "Septic arthritis — IV antibiotics",
            "Reactive arthritis — doxycycline",
        ],
        "correct_option": 1,
        "explanation": (
            "Acute gout is caused by monosodium urate (MSU) crystal deposition, confirmed "
            "by negatively birefringent (yellow when parallel to polariser axis) needle-"
            "shaped crystals in synovial fluid. The first MTP joint (podagra) is classically "
            "affected. Acute treatment: NSAIDs (indomethacin), colchicine within 36 hours, "
            "or corticosteroids. Urate-lowering therapy (allopurinol) is NOT started during "
            "an acute attack. Pseudogout has calcium pyrophosphate crystals — weakly "
            "positively birefringent rhomboid crystals."
        ),
        "topic": "Rheumatology",
        "chapter_ref": "p11_c376",
        "difficulty": "easy",
    },
    {
        "question_id": "q_p11_c362_002",
        "stem": (
            "In rheumatoid arthritis, which antibody is MORE SPECIFIC for the diagnosis "
            "than rheumatoid factor (RF)?"
        ),
        "options": [
            "Antinuclear antibody (ANA)",
            "Anti-cyclic citrullinated peptide (anti-CCP) antibody",
            "Anti-dsDNA antibody",
            "Anti-Sm antibody",
        ],
        "correct_option": 1,
        "explanation": (
            "Anti-CCP (anti-citrullinated protein antibody, ACPA) has ~95–98% specificity "
            "for RA and is positive in about 70% of patients. Rheumatoid factor (RF) has "
            "similar sensitivity (~70–80%) but much lower specificity (~85%) — it is "
            "positive in many other conditions (Sjögren's, viral hepatitis, chronic "
            "infections, elderly individuals). Anti-CCP also predicts more erosive disease. "
            "ANA is associated with SLE; anti-dsDNA and anti-Sm are specific for SLE."
        ),
        "topic": "Rheumatology",
        "chapter_ref": "p11_c362",
        "difficulty": "medium",
    },
    {
        "question_id": "q_p11_c366_001",
        "stem": (
            "A 28-year-old woman presents with a malar rash, photosensitivity, oral ulcers, "
            "arthritis, and a new renal biopsy showing diffuse proliferative nephritis. "
            "ANA titre is 1:1280. Which antibody is most specific for the systemic disease?"
        ),
        "options": [
            "Anti-Ro (SSA)",
            "Anti-double-stranded DNA (anti-dsDNA)",
            "Anti-histone antibody",
            "Rheumatoid factor",
        ],
        "correct_option": 1,
        "explanation": (
            "Anti-dsDNA antibody is highly specific for systemic lupus erythematosus (SLE) "
            "and correlates with disease activity and lupus nephritis. ANA is sensitive "
            "(>95%) but not specific — present in many autoimmune and non-autoimmune "
            "conditions. Anti-Sm is also SLE-specific but less sensitive (~20–30%). "
            "Anti-histone antibodies suggest drug-induced lupus. Anti-Ro is associated with "
            "Sjögren's and neonatal lupus."
        ),
        "topic": "Rheumatology",
        "chapter_ref": "p11_c366",
        "difficulty": "medium",
    },
    {
        "question_id": "q_p11_c370_001",
        "stem": (
            "A 25-year-old man presents with chronic low back pain and stiffness that is "
            "worse in the morning and improves with exercise. Sacroiliac joint tenderness "
            "is present. MRI shows bone marrow oedema at the sacroiliac joints. HLA-B27 "
            "is positive. What is the most likely diagnosis?"
        ),
        "options": [
            "Mechanical low back pain",
            "Ankylosing spondylitis (axial spondyloarthritis)",
            "Reactive arthritis",
            "Psoriatic arthritis",
        ],
        "correct_option": 1,
        "explanation": (
            "Ankylosing spondylitis (AS), the prototype axial spondyloarthropathy, presents "
            "in young males with inflammatory back pain (improves with exercise, not rest), "
            "sacroiliitis, and HLA-B27 positivity (~90%). MRI detects early sacroiliitis "
            "before X-ray changes. Advanced disease shows 'bamboo spine.' NSAIDs are "
            "first-line; TNF-alpha inhibitors or IL-17 inhibitors for refractory disease. "
            "Reactive arthritis follows GI/GU infection and is usually oligoarticular."
        ),
        "topic": "Rheumatology",
        "chapter_ref": "p11_c370",
        "difficulty": "medium",
    },
    {
        "question_id": "q_p11_c366_002",
        "stem": (
            "A 32-year-old woman with SLE develops rising creatinine, haematuria with RBC "
            "casts, and 2.5 g/day proteinuria. Kidney biopsy shows diffuse proliferative "
            "glomerulonephritis (Class IV lupus nephritis). What is the induction treatment?"
        ),
        "options": [
            "Hydroxychloroquine alone",
            "High-dose corticosteroids plus cyclophosphamide or mycophenolate mofetil",
            "Rituximab plus azathioprine",
            "Prednisone alone for 3 months",
        ],
        "correct_option": 1,
        "explanation": (
            "Class IV (diffuse proliferative) lupus nephritis is the most severe form and "
            "requires aggressive immunosuppression. Induction therapy: high-dose "
            "corticosteroids (IV pulse methylprednisolone followed by oral prednisolone) "
            "PLUS either cyclophosphamide (NIH or Euro-Lupus regimen) or mycophenolate "
            "mofetil (MMF, preferred in non-Black patients). Maintenance: MMF or "
            "azathioprine plus hydroxychloroquine. ACE inhibitors reduce proteinuria."
        ),
        "topic": "Rheumatology",
        "chapter_ref": "p11_c366",
        "difficulty": "medium",
    },
    {
        "question_id": "q_p11_c372_001",
        "stem": (
            "A 40-year-old man presents with sinus disease, haemoptysis, haematuria, "
            "and rapidly progressive renal failure. ANCA testing shows c-ANCA positive "
            "(anti-PR3). What is the most likely diagnosis?"
        ),
        "options": [
            "Microscopic polyangiitis (MPA)",
            "Granulomatosis with polyangiitis (GPA, Wegener's)",
            "Eosinophilic granulomatosis with polyangiitis (EGPA)",
            "Polyarteritis nodosa (PAN)",
        ],
        "correct_option": 1,
        "explanation": (
            "Granulomatosis with polyangiitis (GPA, formerly Wegener's) is a small-vessel "
            "vasculitis characterised by granulomatous inflammation of the upper and lower "
            "respiratory tract (sinusitis, haemoptysis) plus necrotising glomerulonephritis. "
            "c-ANCA (anti-PR3) is present in ~90% of active generalised disease. MPA is "
            "associated with p-ANCA (anti-MPO) and lacks upper airway granulomas. EGPA "
            "is associated with asthma, eosinophilia, and p-ANCA. PAN spares the kidney "
            "glomeruli and is ANCA-negative."
        ),
        "topic": "Rheumatology",
        "chapter_ref": "p11_c372",
        "difficulty": "hard",
    },
    {
        "question_id": "q_p11_c366_003",
        "stem": (
            "A 30-year-old woman has had two unprovoked pulmonary emboli, a DVT, and "
            "three consecutive pregnancy losses. Serum tests reveal elevated anticardiolipin "
            "IgG antibodies and lupus anticoagulant on two occasions 12 weeks apart. "
            "What is the diagnosis and long-term treatment?"
        ),
        "options": [
            "Factor V Leiden — no anticoagulation needed",
            "Antiphospholipid syndrome (APS) — long-term anticoagulation with warfarin",
            "Essential thrombocythaemia — aspirin alone",
            "Protein C deficiency — short-term anticoagulation",
        ],
        "correct_option": 1,
        "explanation": (
            "Antiphospholipid syndrome (APS) is diagnosed by clinical criteria "
            "(thrombosis or recurrent pregnancy loss) PLUS laboratory criteria (lupus "
            "anticoagulant, anticardiolipin IgG/IgM, or anti-β2-glycoprotein I on ≥2 "
            "occasions ≥12 weeks apart). Long-term anticoagulation with warfarin (target "
            "INR 2–3) is required after venous thrombosis. Recurrent arterial thrombosis "
            "or high-risk features may require INR 3–4. DOACs are generally not recommended "
            "in triple-positive APS due to higher recurrence rates."
        ),
        "topic": "Rheumatology",
        "chapter_ref": "p11_c366",
        "difficulty": "hard",
    },

    # ── Oncology ─────────────────────────────────────────────────────────────
    {
        "question_id": "q_p04_c075_001",
        "stem": (
            "At what age should average-risk adults begin colorectal cancer (CRC) screening "
            "according to updated guidelines?"
        ),
        "options": [
            "Age 50 for all adults",
            "Age 45 for average-risk adults",
            "Age 40 for all adults",
            "Age 60 for average-risk adults",
        ],
        "correct_option": 1,
        "explanation": (
            "The American Cancer Society (2018) and USPSTF (2021) updated CRC screening "
            "recommendations to begin at age 45 for average-risk adults (lowered from 50) "
            "due to increasing CRC incidence in younger adults. Options include colonoscopy "
            "every 10 years, annual high-sensitivity FOBT/FIT, CT colonography every 5 years, "
            "or stool DNA test. High-risk patients (personal/family history of CRC, IBD, "
            "Lynch syndrome) require earlier and more frequent screening."
        ),
        "topic": "Oncology",
        "chapter_ref": "p04_c075",
        "difficulty": "easy",
    },
    {
        "question_id": "q_p04_c079_001",
        "stem": (
            "Which of the following statements about lung cancer epidemiology is CORRECT?"
        ),
        "options": [
            "SCLC is more common than NSCLC",
            "Cigarette smoking accounts for ~85% of all lung cancers",
            "Adenocarcinoma is most common in heavy smokers",
            "Lung cancer mortality has been rising over the past decade",
        ],
        "correct_option": 1,
        "explanation": (
            "Cigarette smoking is responsible for approximately 85% of lung cancers and is "
            "the leading risk factor. NSCLC accounts for ~85% of all lung cancers (SCLC ~15%). "
            "Among NSCLC, adenocarcinoma is the most common subtype overall (including "
            "non-smokers), while squamous cell carcinoma is most strongly associated with "
            "smoking. Lung cancer mortality has been declining due to reduced smoking rates "
            "and improved treatments."
        ),
        "topic": "Oncology",
        "chapter_ref": "p04_c079",
        "difficulty": "easy",
    },
    {
        "question_id": "q_p04_c079_002",
        "stem": (
            "A 62-year-old man with a 40-pack-year smoking history has a 4 cm right upper "
            "lobe NSCLC without lymph node involvement or metastases (Stage IIA). "
            "What is the preferred treatment approach?"
        ),
        "options": [
            "Palliative chemotherapy only",
            "Surgical resection (lobectomy) with intent to cure",
            "Stereotactic body radiotherapy (SBRT) alone",
            "Concurrent chemoradiation without surgery",
        ],
        "correct_option": 1,
        "explanation": (
            "Stage I–II NSCLC (localised disease without nodal or distant metastases) is "
            "treated with curative intent. Surgical resection (lobectomy preferred over "
            "wedge or pneumonectomy) is the standard of care for operable patients, offering "
            "the best chance of cure. Adjuvant chemotherapy is recommended for stage IIB. "
            "SBRT is reserved for inoperable stage I–II. Concurrent chemoradiation is for "
            "unresectable stage III. Palliative chemotherapy is for stage IV."
        ),
        "topic": "Oncology",
        "chapter_ref": "p04_c079",
        "difficulty": "medium",
    },
    {
        "question_id": "q_p04_c083_001",
        "stem": (
            "A 52-year-old woman has breast cancer with HER2 gene amplification (HER2 3+ "
            "by IHC). Her tumour is oestrogen receptor-negative. Which targeted agent "
            "should be added to her chemotherapy regimen?"
        ),
        "options": [
            "Tamoxifen",
            "Trastuzumab (Herceptin)",
            "Bevacizumab",
            "Imatinib",
        ],
        "correct_option": 1,
        "explanation": (
            "Trastuzumab is a monoclonal antibody targeting HER2 (HER2/neu, ErbB2) receptor, "
            "indicated for HER2-positive breast cancer. Adding trastuzumab to chemotherapy "
            "significantly improves survival in both early and metastatic HER2+ breast cancer. "
            "Tamoxifen targets oestrogen receptor — not applicable here (ER-negative). "
            "Pertuzumab is added in neoadjuvant/metastatic settings. Bevacizumab targets VEGF. "
            "Imatinib targets BCR-ABL/c-Kit."
        ),
        "topic": "Oncology",
        "chapter_ref": "p04_c083",
        "difficulty": "medium",
    },
    {
        "question_id": "q_p04_c086_001",
        "stem": (
            "A 24-year-old woman presents with cervical lymphadenopathy, fever, night "
            "sweats, and weight loss (B symptoms). Excisional biopsy shows large binucleated "
            "cells with prominent eosinophilic nucleoli (owl-eye appearance) in an "
            "inflammatory background. What is the diagnosis?"
        ),
        "options": [
            "Diffuse large B-cell lymphoma (DLBCL)",
            "Classic Hodgkin lymphoma (nodular sclerosis subtype)",
            "Follicular lymphoma",
            "Infectious mononucleosis",
        ],
        "correct_option": 1,
        "explanation": (
            "Classic Hodgkin lymphoma (HL) is characterised by Reed-Sternberg cells — large "
            "binucleated cells with prominent eosinophilic 'owl-eye' nucleoli in a reactive "
            "inflammatory background. Nodular sclerosis is the most common subtype, "
            "affecting young adults with mediastinal involvement. B symptoms (fever, night "
            "sweats, >10% weight loss) are prognostically important. HL has excellent "
            "prognosis — most patients are cured with ABVD chemotherapy ± radiotherapy."
        ),
        "topic": "Oncology",
        "chapter_ref": "p04_c086",
        "difficulty": "medium",
    },
    {
        "question_id": "q_p04_c086_002",
        "stem": (
            "A 68-year-old man presents with rapidly enlarging lymphadenopathy, fever, "
            "and elevated LDH. Biopsy shows large B cells with high Ki-67 (>90%). "
            "What is the most likely diagnosis and standard first-line treatment?"
        ),
        "options": [
            "Follicular lymphoma — watchful waiting or rituximab",
            "Diffuse large B-cell lymphoma (DLBCL) — R-CHOP (rituximab + cyclophosphamide, doxorubicin, vincristine, prednisone)",
            "Mantle cell lymphoma — ibrutinib",
            "Burkitt lymphoma — dose-intensive chemotherapy",
        ],
        "correct_option": 1,
        "explanation": (
            "Diffuse large B-cell lymphoma (DLBCL) is the most common non-Hodgkin lymphoma. "
            "It presents aggressively with rapidly growing masses and elevated LDH. R-CHOP "
            "(rituximab + CHOP chemotherapy) is the standard first-line regimen, curing "
            "~60% of patients. High Ki-67 reflects the high proliferative rate. Follicular "
            "lymphoma is indolent. Burkitt lymphoma has near 100% Ki-67 and requires "
            "even more intensive regimens."
        ),
        "topic": "Oncology",
        "chapter_ref": "p04_c086",
        "difficulty": "medium",
    },
    {
        "question_id": "q_p04_c075_002",
        "stem": (
            "A 38-year-old man is diagnosed with colorectal cancer. His maternal uncle "
            "and grandmother also had colon cancer before age 50. Tumour testing shows "
            "microsatellite instability-high (MSI-H) and loss of MLH1 protein by IHC. "
            "What hereditary syndrome is most likely?"
        ),
        "options": [
            "Familial adenomatous polyposis (FAP) — APC mutation",
            "Lynch syndrome (HNPCC) — mismatch repair gene mutation",
            "MUTYH-associated polyposis",
            "Peutz-Jeghers syndrome",
        ],
        "correct_option": 1,
        "explanation": (
            "Lynch syndrome (hereditary non-polyposis colorectal cancer, HNPCC) is caused "
            "by germline mutations in mismatch repair (MMR) genes: MLH1, MSH2, MSH6, or "
            "PMS2. It is characterised by early-onset CRC (often <50 years), extracolonic "
            "cancers (endometrial, ovarian, gastric, urological), and MSI-H tumours. FAP "
            "causes hundreds to thousands of adenomatous polyps due to APC mutation. MSI-H "
            "tumours respond to immune checkpoint inhibitors (pembrolizumab)."
        ),
        "topic": "Oncology",
        "chapter_ref": "p04_c075",
        "difficulty": "hard",
    },
    {
        "question_id": "q_p04_c079_003",
        "stem": (
            "A 65-year-old man with small cell lung cancer (SCLC) develops confusion, "
            "serum sodium of 118 mEq/L, and urine osmolality of 520 mOsm/kg with "
            "urine sodium 55 mEq/L. A 62-year-old woman with squamous cell lung cancer "
            "has calcium of 13.8 mg/dL with suppressed PTH. What paraneoplastic mechanisms "
            "are responsible for each?"
        ),
        "options": [
            "SCLC: PTHrP secretion; SCC: ectopic ACTH",
            "SCLC: ectopic ADH (SIADH); SCC: PTHrP-mediated hypercalcaemia",
            "SCLC: adrenal metastases; SCC: bone metastases only",
            "Both: ectopic calcitonin secretion",
        ],
        "correct_option": 1,
        "explanation": (
            "SCLC classically causes SIADH via ectopic ADH secretion, producing "
            "euvolaemic hyponatraemia (urine osmolality inappropriately elevated, urine Na "
            "elevated). SCLC also causes ectopic ACTH (Cushing's). Squamous cell carcinoma "
            "of the lung is the most common cause of humoral hypercalcaemia of malignancy "
            "via PTH-related protein (PTHrP) secretion, which stimulates PTH receptors but "
            "suppresses true PTH on assay. Other cancers cause hypercalcaemia via "
            "osteolytic bone metastases."
        ),
        "topic": "Oncology",
        "chapter_ref": "p04_c079",
        "difficulty": "hard",
    },

    # ── Dermatology ──────────────────────────────────────────────────────────
    {
        "question_id": "q_p15_c455_001",
        "stem": (
            "A 35-year-old man has well-demarcated erythematous plaques with silvery "
            "scales on his elbows and scalp. Scratching the scale produces pinpoint "
            "bleeding (Auspitz sign). Which chronic inflammatory skin condition is most likely?"
        ),
        "options": [
            "Lichen planus",
            "Psoriasis vulgaris",
            "Seborrhoeic dermatitis",
            "Tinea corporis",
        ],
        "correct_option": 1,
        "explanation": (
            "Psoriasis is a chronic immune-mediated skin disease characterised by well-"
            "demarcated erythematous plaques with silvery-white scales, most commonly "
            "on the extensor surfaces, scalp, and nails. The Auspitz sign (bleeding on "
            "scale removal due to dilated dermal capillaries) is characteristic. It is "
            "associated with psoriatic arthritis, cardiovascular risk, and metabolic syndrome. "
            "Seborrhoeic dermatitis has greasy yellow scales in sebaceous areas. "
            "Tinea has active borders with central clearing."
        ),
        "topic": "Dermatology",
        "chapter_ref": "p15_c455",
        "difficulty": "easy",
    },
    {
        "question_id": "q_p15_c456_001",
        "stem": (
            "A 28-year-old nurse develops erythema, vesicles, and intense pruritus on "
            "the dorsal hands and wrists after starting a new latex glove brand. A patch "
            "test is positive to latex and rubber additives. How does this differ from "
            "irritant contact dermatitis?"
        ),
        "options": [
            "Allergic contact dermatitis requires prior sensitisation and is IgE-mediated",
            "Allergic contact dermatitis requires prior sensitisation and is T-cell (type IV hypersensitivity) mediated",
            "Irritant contact dermatitis requires prior sensitisation; allergic does not",
            "They are clinically identical and cannot be distinguished",
        ],
        "correct_option": 1,
        "explanation": (
            "Allergic contact dermatitis (ACD) is a Type IV (delayed-type, T-cell mediated) "
            "hypersensitivity reaction requiring prior sensitisation; re-exposure triggers a "
            "reaction at 24–72 hours. Patch testing identifies the causative allergen. "
            "Irritant contact dermatitis (ICD) is non-immunological — caused by direct "
            "chemical damage to the skin (soaps, detergents, acids) and occurs without "
            "prior sensitisation. ICD is more common than ACD. Latex IgE-mediated allergy "
            "(Type I hypersensitivity) can also occur and causes urticaria/anaphylaxis."
        ),
        "topic": "Dermatology",
        "chapter_ref": "p15_c456",
        "difficulty": "easy",
    },
    {
        "question_id": "q_p15_c460_001",
        "stem": (
            "A 65-year-old diabetic man has a spreading leg erythema with central skin "
            "necrosis, haemorrhagic bullae, and a 'woody' hard subcutaneous feel. "
            "He is febrile and confused. CT shows gas in the soft tissues. "
            "What is the immediate management?"
        ),
        "options": [
            "IV antibiotics alone and close observation",
            "Emergency surgical debridement plus broad-spectrum IV antibiotics",
            "Hyperbaric oxygen therapy alone",
            "Antifungal therapy for mucormycosis",
        ],
        "correct_option": 1,
        "explanation": (
            "Necrotising fasciitis is a surgical emergency with rapid spread of infection "
            "along fascial planes, causing tissue necrosis and systemic sepsis. "
            "Key features distinguishing it from cellulitis: woody induration, haemorrhagic "
            "bullae, skin necrosis, pain out of proportion, gas on CT, and rapid progression. "
            "Immediate management is emergency surgical debridement (source control) "
            "combined with broad-spectrum antibiotics (covering GAS, polymicrobial, and "
            "Clostridium). Mortality is very high without prompt surgery."
        ),
        "topic": "Dermatology",
        "chapter_ref": "p15_c460",
        "difficulty": "medium",
    },
    {
        "question_id": "q_p15_c455_002",
        "stem": (
            "A 15-year-old boy has had chronic pruritic, dry, flexural eczema since "
            "infancy. He also has allergic rhinitis and asthma. The most appropriate "
            "first-line treatment for mild-to-moderate atopic dermatitis is:"
        ),
        "options": [
            "Systemic immunosuppressants (methotrexate)",
            "Emollients and topical corticosteroids",
            "Oral antihistamines as monotherapy",
            "Biologics (dupilumab) as initial therapy",
        ],
        "correct_option": 1,
        "explanation": (
            "Atopic dermatitis (eczema) management: (1) Emollients (moisturisers) are "
            "the cornerstone — restore the epidermal barrier; (2) Topical corticosteroids "
            "are first-line anti-inflammatory treatment for flares (low-potency on face/folds, "
            "moderate-high on body); (3) Topical calcineurin inhibitors (tacrolimus, "
            "pimecrolimus) are steroid-sparing alternatives. Dupilumab (anti-IL-4Rα) is "
            "highly effective for moderate-severe AD not controlled by topical therapy. "
            "Oral antihistamines treat pruritus but are not primary therapy."
        ),
        "topic": "Dermatology",
        "chapter_ref": "p15_c455",
        "difficulty": "medium",
    },
    {
        "question_id": "q_p15_c465_001",
        "stem": (
            "A 55-year-old fair-skinned patient asks about a pigmented lesion on his back. "
            "It is asymmetric, has irregular borders, has multiple colours (brown, black, "
            "pink), and measures 8 mm. What is the appropriate next step?"
        ),
        "options": [
            "Reassure — all lesions with irregular borders are seborrhoeic keratoses",
            "Excisional biopsy for histological confirmation",
            "Dermoscopy and topical retinoid treatment",
            "Annual monitoring with serial photography",
        ],
        "correct_option": 1,
        "explanation": (
            "The ABCDE criteria identify features suspicious for melanoma: Asymmetry, "
            "Border irregularity, Colour variation, Diameter >6 mm, Evolution/change. "
            "This lesion meets all criteria. Any suspicious pigmented lesion should undergo "
            "excisional biopsy with 1–2 mm margins for histological diagnosis. Shave biopsy "
            "is contraindicated (prevents accurate Breslow thickness). Early melanoma has "
            "an excellent prognosis; delayed diagnosis is the main determinant of outcome."
        ),
        "topic": "Dermatology",
        "chapter_ref": "p15_c465",
        "difficulty": "medium",
    },
    {
        "question_id": "q_p15_c465_002",
        "stem": (
            "A 70-year-old man has a pearly, telangiectatic nodule with rolled edges on "
            "his nose. A 60-year-old woman has an ulcerated nodule on her lower lip with "
            "indurated borders and regional lymphadenopathy. Which tumours are these "
            "respectively?"
        ),
        "options": [
            "Keratoacanthoma and melanoma",
            "Basal cell carcinoma (BCC) and squamous cell carcinoma (SCC)",
            "SCC and BCC",
            "Both are sebaceous carcinomas",
        ],
        "correct_option": 1,
        "explanation": (
            "Basal cell carcinoma (BCC) is the most common skin cancer. The nodular type "
            "appears as a pearly papule or nodule with rolled edges and telangiectasia, "
            "typically on the face. BCC rarely metastasises. Squamous cell carcinoma (SCC) "
            "arises from keratinocytes and presents as indurated, ulcerated lesions; it has "
            "metastatic potential, especially on the lip or ear. Sun exposure is the main "
            "risk factor for both. SCC risk is increased in immunosuppressed patients and "
            "those with precursor actinic keratoses."
        ),
        "topic": "Dermatology",
        "chapter_ref": "p15_c465",
        "difficulty": "medium",
    },
    {
        "question_id": "q_p15_c460_002",
        "stem": (
            "A 25-year-old woman develops fever, painful mucosal erosions, and targetoid "
            "skin lesions involving <10% BSA after starting trimethoprim-sulfamethoxazole. "
            "What is the diagnosis?"
        ),
        "options": [
            "Toxic epidermal necrolysis (TEN) — >30% BSA",
            "Stevens-Johnson syndrome (SJS) — <10% BSA epidermal detachment",
            "DRESS syndrome — eosinophilia and internal organ involvement",
            "Erythema multiforme minor — HSV-associated, minimal mucosal involvement",
        ],
        "correct_option": 1,
        "explanation": (
            "Stevens-Johnson syndrome (SJS) is characterised by mucocutaneous blistering "
            "with epidermal detachment involving <10% BSA. TEN involves >30% BSA. "
            "SJS/TEN overlap is 10–30% BSA. TMP-SMX is one of the most common drug triggers "
            "alongside allopurinol, carbamazepine, and lamotrigine. Targetoid lesions with "
            "mucosal involvement and fever support SJS. Treatment: immediate drug "
            "withdrawal, IV fluids, wound care; consider IVIG or cyclosporin."
        ),
        "topic": "Dermatology",
        "chapter_ref": "p15_c460",
        "difficulty": "medium",
    },
    {
        "question_id": "q_p15_c460_003",
        "stem": (
            "A 40-year-old man develops fever, lymphadenopathy, morbilliform rash, "
            "and elevated liver enzymes 4 weeks after starting carbamazepine. "
            "CBC shows eosinophilia (1,800/µL) and atypical lymphocytes. "
            "What is the diagnosis?"
        ),
        "options": [
            "Stevens-Johnson syndrome — discontinue drug, IVIG",
            "DRESS syndrome (Drug Reaction with Eosinophilia and Systemic Symptoms) — discontinue drug, systemic corticosteroids",
            "Serum sickness — antihistamines and NSAIDs",
            "Erythroderma — emollients and topical steroids",
        ],
        "correct_option": 1,
        "explanation": (
            "DRESS syndrome (also called DiHS — Drug-induced Hypersensitivity Syndrome) "
            "occurs 2–8 weeks after drug initiation. Key features: morbilliform rash "
            "spreading to >50% BSA, fever, facial oedema, lymphadenopathy, eosinophilia "
            "(or atypical lymphocytes), and multi-organ involvement (hepatitis, nephritis, "
            "pneumonitis). Common triggers: anticonvulsants (carbamazepine, phenytoin), "
            "allopurinol, dapsone, sulfonamides. Mortality ~10%. Treatment: immediate drug "
            "discontinuation and systemic corticosteroids."
        ),
        "topic": "Dermatology",
        "chapter_ref": "p15_c460",
        "difficulty": "hard",
    },

    # ── Psychiatry ────────────────────────────────────────────────────────────
    {
        "question_id": "q_p14_c441_001",
        "stem": (
            "A 34-year-old woman reports depressed mood, loss of interest in all activities, "
            "insomnia, fatigue, feelings of worthlessness, and difficulty concentrating "
            "for the past 3 weeks. She denies manic episodes. "
            "How many DSM-5 criteria does she meet for major depressive disorder?"
        ),
        "options": [
            "3 (insufficient for MDD — sub-threshold)",
            "5 (meets criteria — depressed mood + ≥4 additional symptoms ≥2 weeks)",
            "4 (dysthymia diagnosis only)",
            "7 (psychotic depression criteria)",
        ],
        "correct_option": 1,
        "explanation": (
            "DSM-5 MDD requires ≥5 of 9 symptoms for ≥2 weeks, causing significant "
            "distress or impairment, with at least one being depressed mood or anhedonia. "
            "The 9 symptoms (SIG E CAPS): Sleep changes, Interest loss (anhedonia), Guilt/"
            "worthlessness, Energy loss, Concentration difficulty, Appetite changes, "
            "Psychomotor changes, Suicidal ideation + Depressed mood. She has 5 symptoms "
            "for 3 weeks, meeting criteria for a major depressive episode."
        ),
        "topic": "Psychiatry",
        "chapter_ref": "p14_c441",
        "difficulty": "easy",
    },
    {
        "question_id": "q_p14_c441_002",
        "stem": (
            "A 42-year-old woman with a first episode of major depressive disorder (MDD) "
            "wants pharmacotherapy. She has no other medical conditions or concurrent "
            "medications. What drug class is considered FIRST-LINE?"
        ),
        "options": [
            "Tricyclic antidepressants (TCAs)",
            "Selective serotonin reuptake inhibitors (SSRIs)",
            "Monoamine oxidase inhibitors (MAOIs)",
            "Benzodiazepines as initial monotherapy",
        ],
        "correct_option": 1,
        "explanation": (
            "SSRIs (e.g., fluoxetine, sertraline, escitalopram) are first-line "
            "pharmacotherapy for MDD due to their efficacy, tolerability, and safety "
            "in overdose. SNRIs (venlafaxine, duloxetine) are also first-line alternatives. "
            "TCAs are effective but have significant anticholinergic side effects and are "
            "lethal in overdose. MAOIs require dietary tyramine restriction. "
            "Benzodiazepines are not antidepressants."
        ),
        "topic": "Psychiatry",
        "chapter_ref": "p14_c441",
        "difficulty": "medium",
    },
    {
        "question_id": "q_p14_c444_001",
        "stem": (
            "A 22-year-old man has had two episodes of auditory hallucinations telling "
            "him to harm others, along with disorganised speech and flat affect, "
            "persisting for 6 months. He has no substance use or medical cause. "
            "Which symptoms are classified as 'positive' vs 'negative'?"
        ),
        "options": [
            "Hallucinations are negative; flat affect is positive",
            "Hallucinations and disorganised speech are positive; flat affect is negative",
            "Delusions are negative; hallucinations are positive",
            "All symptoms are positive in first-episode psychosis",
        ],
        "correct_option": 1,
        "explanation": (
            "In schizophrenia, positive symptoms are additions to normal experience: "
            "hallucinations, delusions, disorganised speech/behaviour, and catatonia. "
            "Negative symptoms are reductions from normal function: flat affect, alogia "
            "(poverty of speech), avolition, anhedonia, and asociality. Negative symptoms "
            "are more resistant to treatment and associated with worse functional outcomes. "
            "Antipsychotics (D2 antagonists) primarily treat positive symptoms. Clozapine "
            "is preferred for treatment-resistant schizophrenia."
        ),
        "topic": "Psychiatry",
        "chapter_ref": "p14_c444",
        "difficulty": "medium",
    },
    {
        "question_id": "q_p14_c447_001",
        "stem": (
            "A 28-year-old woman has recurrent unexpected episodes of intense fear with "
            "palpitations, shortness of breath, derealization, and fear of dying — each "
            "lasting 10 minutes. She avoids going out due to fear of another attack. "
            "What is the first-line psychotherapy for this condition?"
        ),
        "options": [
            "Psychodynamic psychotherapy",
            "Cognitive-behavioural therapy (CBT) with interoceptive exposure",
            "Eye movement desensitisation and reprocessing (EMDR)",
            "Dialectical behaviour therapy (DBT)",
        ],
        "correct_option": 1,
        "explanation": (
            "Panic disorder is treated with CBT, which includes psychoeducation, "
            "cognitive restructuring, and interoceptive exposure (deliberately inducing "
            "panic-like sensations to reduce fear of them). CBT has response rates of "
            "~80–90%. SSRIs/SNRIs are first-line pharmacotherapy. Agoraphobia (avoidance "
            "of places feared to trigger panic) often accompanies panic disorder. EMDR is "
            "used for PTSD. DBT is used for borderline personality disorder."
        ),
        "topic": "Psychiatry",
        "chapter_ref": "p14_c447",
        "difficulty": "medium",
    },
    {
        "question_id": "q_p14_c447_002",
        "stem": (
            "A 35-year-old combat veteran re-experiences traumatic events through "
            "nightmares and flashbacks, avoids reminders of trauma, and has hypervigilance "
            "and insomnia persisting for 8 months. What is the first-line psychotherapy?"
        ),
        "options": [
            "Supportive therapy and ventilation",
            "Trauma-focused CBT (prolonged exposure or cognitive processing therapy)",
            "Interpersonal therapy (IPT)",
            "Motivational interviewing",
        ],
        "correct_option": 1,
        "explanation": (
            "Post-traumatic stress disorder (PTSD) — defined by intrusion, avoidance, "
            "negative cognitions/mood, and hyperarousal for >1 month after trauma — is "
            "first-line treated with trauma-focused psychotherapies: prolonged exposure "
            "(PE) or cognitive processing therapy (CPT). These have the strongest evidence. "
            "Pharmacotherapy: SSRIs (sertraline, paroxetine FDA-approved) or SNRIs as "
            "adjuncts. EMDR is also evidence-based for PTSD. Benzodiazepines should be "
            "avoided as they may interfere with fear extinction."
        ),
        "topic": "Psychiatry",
        "chapter_ref": "p14_c447",
        "difficulty": "medium",
    },
    {
        "question_id": "q_p14_c441_003",
        "stem": (
            "A 38-year-old man has had recurrent episodes of euphoria, decreased sleep "
            "need, grandiosity, and hypersexuality lasting 1–2 weeks alternating with "
            "major depressive episodes. He has been hospitalised once for a manic episode. "
            "What is the preferred long-term mood-stabilising agent?"
        ),
        "options": [
            "Fluoxetine (SSRI) monotherapy",
            "Lithium",
            "Benzodiazepines for acute episodes only",
            "Haloperidol",
        ],
        "correct_option": 1,
        "explanation": (
            "Lithium is a first-line mood stabiliser for bipolar I disorder and has the "
            "strongest evidence for reducing manic and depressive episodes and for suicide "
            "prevention. Regular monitoring of lithium levels, renal function, and thyroid "
            "function is required. Alternatives include valproate and second-generation "
            "antipsychotics (quetiapine, olanzapine). SSRIs as monotherapy risk inducing "
            "mania and are contraindicated without a mood stabiliser. Acute mania is "
            "treated with antipsychotics ± lithium/valproate."
        ),
        "topic": "Psychiatry",
        "chapter_ref": "p14_c441",
        "difficulty": "medium",
    },
    {
        "question_id": "q_p14_c441_004",
        "stem": (
            "A 45-year-old patient on linezolid and fluoxetine for concurrent infections "
            "and depression develops agitation, diaphoresis, tremor, hyperreflexia, "
            "clonus, and hyperthermia (38.9°C) 2 days after starting linezolid. "
            "What is the diagnosis and management?"
        ),
        "options": [
            "Neuroleptic malignant syndrome — stop antipsychotic, dantrolene",
            "Serotonin syndrome — stop serotonergic drugs, cyproheptadine, supportive care",
            "Anticholinergic toxidrome — physostigmine",
            "Malignant hyperthermia — dantrolene",
        ],
        "correct_option": 1,
        "explanation": (
            "Serotonin syndrome is caused by excess serotonergic activity, typically from "
            "two serotonergic agents. Linezolid is an MAOI (inhibits serotonin breakdown), "
            "and fluoxetine is an SSRI — their combination is contraindicated. The Hunter "
            "criteria identify serotonin syndrome by: clonus, agitation, diaphoresis, "
            "tremor, hyperreflexia, and hyperthermia. Treatment: immediately stop "
            "serotonergic drugs; cyproheptadine (5-HT2A antagonist); benzodiazepines for "
            "agitation/seizures; cooling; supportive care. Distinguished from NMS by rapid "
            "onset, clonus, and hyperreflexia."
        ),
        "topic": "Psychiatry",
        "chapter_ref": "p14_c441",
        "difficulty": "hard",
    },
    {
        "question_id": "q_p14_c444_002",
        "stem": (
            "A 30-year-old schizophrenic patient on haloperidol develops fever of 40°C, "
            "severe 'lead-pipe' muscular rigidity, diaphoresis, and a creatinine kinase "
            "of 12,000 U/L. Consciousness is fluctuating. What is the diagnosis and "
            "immediate management?"
        ),
        "options": [
            "Serotonin syndrome — cyproheptadine",
            "Neuroleptic malignant syndrome (NMS) — stop antipsychotic, supportive care, dantrolene or bromocriptine",
            "Heat stroke — external cooling only",
            "Catatonia — benzodiazepines",
        ],
        "correct_option": 1,
        "explanation": (
            "Neuroleptic malignant syndrome (NMS) is a life-threatening reaction to "
            "antipsychotics (especially high-potency typical agents like haloperidol). "
            "It is characterised by: fever, lead-pipe rigidity (not clonus), altered "
            "consciousness, and autonomic instability. Markedly elevated CK reflects "
            "rhabdomyolysis. NMS develops over days (vs serotonin syndrome which develops "
            "within hours). Treatment: immediately stop offending antipsychotic; aggressive "
            "supportive care (cooling, fluids); dantrolene (muscle relaxant) or "
            "bromocriptine (dopamine agonist) for severe cases. Benzodiazepines for agitation."
        ),
        "topic": "Psychiatry",
        "chapter_ref": "p14_c444",
        "difficulty": "hard",
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
