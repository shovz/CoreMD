"""
seed_cases.py — Seed 40 clinical case documents into MongoDB.

Idempotent: cases already present (keyed on case_id) are skipped.
A unique index on case_id is created automatically.

Usage (from project root):
    python backend/scripts/seed_cases.py
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
# Case data — 40 cases across 10 specialties
# chapter_ref format: p{part:02d}_c{chapter:03d}  (matches ingestion output)
#   Part 4  = Oncology and Hematology
#   Part 5  = Infectious Diseases
#   Part 6  = Disorders of the Cardiovascular System
#   Part 7  = Disorders of the Respiratory System
#   Part 9  = Disorders of the Kidney and Urinary Tract
#   Part 10 = Disorders of the Gastrointestinal System
#   Part 11 = Immune-Mediated, Inflammatory, and Rheumatologic Disorders
#   Part 12 = Endocrinology and Metabolism
#   Part 13 = Neurological Disorders
# ---------------------------------------------------------------------------

CASES: list[dict[str, Any]] = [
    # ── Cardiology (Part 6) ──────────────────────────────────────────────────
    {
        "case_id": "case_cardiology_001",
        "title": "Inferior STEMI in a 58-Year-Old Diabetic Man",
        "specialty": "Cardiology",
        "presentation": (
            "A 58-year-old man with type 2 diabetes and hypertension presents to the ED "
            "with 2 hours of crushing substernal chest pain radiating to the left arm, "
            "accompanied by diaphoresis and nausea."
        ),
        "history": (
            "PMH: T2DM (10 years), hypertension, hyperlipidaemia. Medications: metformin, "
            "lisinopril, atorvastatin. Family history: father died of MI at age 62. "
            "Social: 20 pack-year smoking history, quit 5 years ago."
        ),
        "physical_exam": (
            "BP 155/95, HR 102 bpm, RR 18, SpO2 96% on room air. Diaphoretic. JVP not "
            "elevated. Heart: regular rhythm, no murmurs. Lungs: clear. Extremities: no oedema."
        ),
        "labs": (
            "Troponin I: 4.2 ng/mL (elevated). BMP: glucose 210, creatinine 1.1, K+ 4.2. "
            "CBC: WBC 11.2, Hgb 13.8. Coagulation: normal. Lipid panel: LDL 142 mg/dL."
        ),
        "imaging": (
            "ECG: ST elevations in II, III, aVF with reciprocal changes in I and aVL — "
            "consistent with inferior STEMI. CXR: no pulmonary oedema, normal cardiac silhouette."
        ),
        "discussion": (
            "Inferior STEMI is most commonly caused by occlusion of the right coronary artery "
            "(RCA). Diabetic patients may present atypically (nausea, diaphoresis without "
            "classic anginal pain). Rapid reperfusion via primary PCI within 90 minutes of "
            "first medical contact is the standard of care and significantly reduces mortality "
            "and left ventricular remodelling."
        ),
        "diagnosis": "Inferior ST-elevation myocardial infarction (STEMI) due to acute RCA occlusion.",
        "management": (
            "Aspirin 325 mg + P2Y12 inhibitor (ticagrelor or clopidogrel). Activate cath lab "
            "for primary PCI. IV unfractionated heparin. Beta-blocker if haemodynamically "
            "stable. High-intensity statin. Post-PCI: dual antiplatelet therapy for 12 months. "
            "ACE inhibitor for LV remodelling prevention."
        ),
        "chapter_ref": "p06_c238",
    },
    {
        "case_id": "case_cardiology_002",
        "title": "New-Onset Atrial Fibrillation with Rapid Ventricular Response",
        "specialty": "Cardiology",
        "presentation": (
            "A 67-year-old woman with a history of hypertension presents with palpitations, "
            "mild dyspnoea, and fatigue for 8 hours. She denies chest pain or syncope."
        ),
        "history": (
            "PMH: hypertension (well-controlled), no prior arrhythmia, no thyroid disease. "
            "Medications: amlodipine 5 mg, hydrochlorothiazide 12.5 mg. "
            "Social: occasional alcohol, non-smoker."
        ),
        "physical_exam": (
            "BP 138/88, HR 142 bpm (irregular), RR 16, SpO2 98%. Jugular veins flat. "
            "Heart: irregularly irregular rhythm, no murmurs. Lungs: clear. "
            "No peripheral oedema."
        ),
        "labs": (
            "TSH: 1.2 mIU/L (normal). BMP: normal electrolytes. CBC: normal. "
            "CMP: normal hepatic function. Troponin: undetectable. BNP: 180 pg/mL."
        ),
        "imaging": (
            "ECG: absent P waves, irregularly irregular narrow-complex tachycardia at 142 bpm. "
            "Echocardiogram: preserved EF (60%), mild left atrial enlargement (4.2 cm), "
            "no valvular abnormality."
        ),
        "discussion": (
            "New-onset AF requires assessment for reversible triggers (thyrotoxicosis, "
            "infection, alcohol, electrolyte abnormalities). Rate vs rhythm control decisions "
            "depend on symptom burden and haemodynamic stability. CHA₂DS₂-VASc score guides "
            "anticoagulation: this patient scores ≥2 (female sex, age ≥65, hypertension), "
            "mandating anticoagulation."
        ),
        "diagnosis": "New-onset atrial fibrillation with rapid ventricular response.",
        "management": (
            "Rate control: IV metoprolol or diltiazem to target HR <110 bpm. "
            "Anticoagulation: initiate DOAC (apixaban preferred). If AF ≤48 h duration "
            "and stable, may consider cardioversion after anticoagulation or TOE to exclude "
            "LA thrombus. Long-term rhythm control with flecainide or amiodarone if symptomatic."
        ),
        "chapter_ref": "p06_c242",
    },
    {
        "case_id": "case_cardiology_003",
        "title": "Aortic Stenosis in a 75-Year-Old with Exertional Syncope",
        "specialty": "Cardiology",
        "presentation": (
            "A 75-year-old man is referred for evaluation of two syncopal episodes on "
            "exertion over the past 3 months. He also reports progressive dyspnoea on "
            "climbing one flight of stairs."
        ),
        "history": (
            "PMH: bicuspid aortic valve diagnosed incidentally at age 50, hypertension, "
            "hyperlipidaemia. Medications: atorvastatin, ramipril. No prior cardiac events. "
            "Social: retired, never smoked."
        ),
        "physical_exam": (
            "BP 110/80, HR 72 bpm regular, RR 14, SpO2 98%. "
            "Slow-rising carotid pulse (pulsus parvus et tardus). "
            "Harsh grade 4/6 crescendo-decrescendo systolic murmur at RUSB radiating to carotids. "
            "Single S2. Mild pulmonary crackles."
        ),
        "labs": (
            "BNP: 420 pg/mL. CBC: Hgb 12.8 (mild anaemia). BMP: Cr 1.2. "
            "LFTs: normal. Coagulation: normal."
        ),
        "imaging": (
            "Echo: severely calcified aortic valve, AVA 0.7 cm², mean gradient 52 mmHg — "
            "severe aortic stenosis. EF 45% (mildly reduced). Mild LV hypertrophy. "
            "CXR: mild pulmonary vascular congestion, prominent aortic knuckle."
        ),
        "discussion": (
            "Severe symptomatic aortic stenosis (syncope, angina, heart failure) carries a "
            "median survival of <2–3 years without intervention. The classic triad of symptoms "
            "— syncope, angina, heart failure — each mark progressively worsening prognosis. "
            "TAVR (transcatheter aortic valve replacement) has become the preferred approach "
            "for intermediate- and high-surgical-risk patients."
        ),
        "diagnosis": "Severe calcific aortic stenosis with exertional syncope (AVA 0.7 cm²).",
        "management": (
            "Refer to heart valve team for TAVR vs SAVR risk assessment. "
            "Avoid vasodilators (risk of hypotension). Diuresis for pulmonary congestion. "
            "Correct anaemia pre-procedurally. Post-TAVR: antiplatelet therapy; "
            "valve-in-valve procedures for degeneration."
        ),
        "chapter_ref": "p06_c241",
    },
    # ── Pulmonology (Part 7) ─────────────────────────────────────────────────
    {
        "case_id": "case_pulmonology_001",
        "title": "COPD Exacerbation in a 72-Year-Old Smoker",
        "specialty": "Pulmonology",
        "presentation": (
            "A 72-year-old man with known COPD presents with 3 days of increased sputum "
            "production (now purulent), worsening dyspnoea, and inability to complete "
            "sentences. He uses salbutamol inhaler 8–10 times daily."
        ),
        "history": (
            "PMH: COPD (GOLD stage III, FEV1 38%), two exacerbations last year requiring "
            "hospital admission. Medications: tiotropium, salmeterol/fluticasone, PRN "
            "salbutamol. 50 pack-year smoking history, still smokes."
        ),
        "physical_exam": (
            "BP 148/90, HR 110, RR 28, SpO2 84% on room air, T 37.9°C. "
            "Uses accessory muscles. Pursed-lip breathing. Barrel chest. "
            "Diffuse expiratory wheeze, prolonged expiratory phase. "
            "No crackles. Mild pitting oedema at ankles."
        ),
        "labs": (
            "ABG (room air): pH 7.31, PaCO2 58 mmHg, PaO2 48 mmHg, HCO3 28 — "
            "type 2 respiratory failure with partial metabolic compensation. "
            "CBC: WBC 14.2 (neutrophilia). CRP: 84 mg/L. Sputum: Gram-positive diplococci."
        ),
        "imaging": (
            "CXR: hyperinflation, flattened diaphragms, no consolidation, no pneumothorax. "
            "ECG: sinus tachycardia, P pulmonale."
        ),
        "discussion": (
            "Acute exacerbations of COPD (AECOPD) are usually triggered by respiratory "
            "infections (bacterial 50%, viral 30%). NIV (BiPAP) is indicated for acute "
            "hypercapnic respiratory failure (pH <7.35, PaCO2 >45). NIV reduces need for "
            "intubation and mortality. Controlled oxygen to target SpO2 88–92% to avoid "
            "hypercapnia worsening."
        ),
        "diagnosis": "Acute exacerbation of COPD (AECOPD) with type 2 respiratory failure.",
        "management": (
            "Controlled O2 (target SpO2 88–92%). NIV (BiPAP). Nebulised salbutamol + "
            "ipratropium. IV methylprednisolone 40 mg/day × 5 days. Amoxicillin-clavulanate "
            "(or doxycycline) if bacterial trigger. DVT prophylaxis. Smoking cessation "
            "counselling. Post-discharge: pulmonary rehabilitation referral."
        ),
        "chapter_ref": "p07_c285",
    },
    {
        "case_id": "case_pulmonology_002",
        "title": "Massive Pulmonary Embolism with Haemodynamic Instability",
        "specialty": "Pulmonology",
        "presentation": (
            "A 48-year-old woman, 3 weeks post-right total knee replacement, presents "
            "with sudden-onset severe dyspnoea, pleuritic chest pain, and near-syncope. "
            "She appears pale and distressed."
        ),
        "history": (
            "PMH: obesity (BMI 34), no prior DVT or PE, no family history of thrombophilia. "
            "Medications: pre-op enoxaparin stopped 2 days post-operatively. "
            "No OCP use. Non-smoker."
        ),
        "physical_exam": (
            "BP 82/50, HR 132 bpm, RR 30, SpO2 80% on 15L O2 via non-rebreather. "
            "Cold, clammy peripheries. JVP markedly elevated at 6 cm above clavicle. "
            "Heart: loud P2, right ventricular heave. Swollen right leg."
        ),
        "labs": (
            "ABG: pH 7.46, PaO2 52 mmHg, PaCO2 28 mmHg — type 1 respiratory failure. "
            "Troponin I: 1.8 ng/mL (elevated). BNP: 980 pg/mL. D-dimer: >10 µg/mL. "
            "CBC: normal. Coagulation: normal."
        ),
        "imaging": (
            "CTPA: bilateral massive central pulmonary emboli extending into both main "
            "pulmonary arteries. Echo (bedside): RV dilatation, flattened IVS ('D-sign'), "
            "RV hypokinesis, estimated RVSP 65 mmHg."
        ),
        "discussion": (
            "Massive PE (haemodynamic instability: SBP <90 mmHg) carries 30-day mortality "
            "of 25–65%. Systemic thrombolysis is indicated for massive PE if no absolute "
            "contraindications. RV dysfunction (troponin rise, RV dilatation on echo) "
            "confirms high risk. Immediate anticoagulation should not delay thrombolysis "
            "in haemodynamically compromised patients."
        ),
        "diagnosis": "Massive bilateral pulmonary embolism with haemodynamic compromise and RV failure.",
        "management": (
            "IV alteplase 100 mg over 2 h (systemic thrombolysis). Anticoagulate with "
            "UFH before and after. If thrombolysis fails or contraindicated: surgical "
            "embolectomy or catheter-directed therapy. Vasopressors (noradrenaline) for "
            "BP support. After stabilisation: transition to DOAC; investigate thrombophilia."
        ),
        "chapter_ref": "p07_c291",
    },
    {
        "case_id": "case_pulmonology_003",
        "title": "Idiopathic Pulmonary Fibrosis in a 66-Year-Old Ex-Smoker",
        "specialty": "Pulmonology",
        "presentation": (
            "A 66-year-old retired carpenter presents with a 2-year history of progressive "
            "dyspnoea on exertion and a dry, non-productive cough. He reports no fevers, "
            "weight loss, or haemoptysis."
        ),
        "history": (
            "PMH: hypertension, type 2 diabetes. 30 pack-year smoking (quit 10 years ago). "
            "Occupational: significant wood dust exposure over 30 years. "
            "Medications: metformin, ramipril. No amiodarone or nitrofurantoin use."
        ),
        "physical_exam": (
            "BP 130/80, HR 78, RR 18, SpO2 93% at rest (drops to 86% on walking). "
            "Bilateral basal fine inspiratory crackles ('Velcro' crackles). "
            "Clubbing of fingers. No cyanosis. No lymphadenopathy."
        ),
        "labs": (
            "CBC: normal. ANA, anti-CCP, RF: negative. "
            "6-minute walk test: 320 m (reduced), SpO2 nadir 82%. "
            "PFTs: FVC 58%, TLC 62%, DLCO 38% — severe restrictive pattern with reduced diffusion."
        ),
        "imaging": (
            "HRCT chest: bilateral basal and subpleural honeycombing with traction "
            "bronchiectasis — usual interstitial pneumonia (UIP) pattern. "
            "No ground-glass opacities. No lymphadenopathy. CXR: bibasal reticular markings."
        ),
        "discussion": (
            "IPF is the most common idiopathic interstitial pneumonia. HRCT showing UIP "
            "pattern (honeycombing ± traction bronchiectasis) in the appropriate clinical "
            "context is diagnostic without surgical lung biopsy. Prognosis is poor (median "
            "survival 3–5 years). Anti-fibrotic agents (nintedanib, pirfenidone) slow FVC "
            "decline but do not reverse established fibrosis."
        ),
        "diagnosis": "Idiopathic pulmonary fibrosis (IPF) with UIP pattern on HRCT.",
        "management": (
            "Anti-fibrotic therapy: nintedanib 150 mg twice daily OR pirfenidone. "
            "Supplemental O2 for exertional desaturation. Pulmonary rehabilitation. "
            "Pneumococcal and annual influenza vaccination. Refer for lung transplant "
            "evaluation (if suitable candidate). Treat GORD (common comorbidity). "
            "Palliative care discussion."
        ),
        "chapter_ref": "p07_c290",
    },
    # ── Nephrology (Part 9) ──────────────────────────────────────────────────
    {
        "case_id": "case_nephrology_001",
        "title": "Contrast-Induced AKI in a Post-Cardiac Catheterisation Patient",
        "specialty": "Nephrology",
        "presentation": (
            "A 70-year-old man with CKD stage 3a (baseline Cr 1.6 mg/dL) underwent "
            "coronary angiography 48 hours ago. Repeat creatinine today is 2.8 mg/dL. "
            "He is oligouric (urine output 200 mL in past 8 h) but haemodynamically stable."
        ),
        "history": (
            "PMH: CKD (diabetic nephropathy), T2DM, hypertension, CAD. "
            "Medications: metformin (held pre-procedure), lisinopril, atorvastatin, aspirin. "
            "No NSAIDs. No nephrotoxin exposure. Received 200 mL IV contrast (iohexol)."
        ),
        "physical_exam": (
            "BP 148/88, HR 72, afebrile. JVP 3 cm. Lungs: clear. "
            "Mild ankle oedema. No rash or livedo reticularis. Bladder not distended."
        ),
        "labs": (
            "Creatinine 2.8 mg/dL (baseline 1.6). BUN 42. K+ 5.2. HCO3 19 (mild metabolic "
            "acidosis). Urine sodium 12 mEq/L, FeNa 0.4% — pre-renal pattern. "
            "UA: trace protein, no casts. No eosinophils."
        ),
        "imaging": (
            "Renal ultrasound: bilateral kidneys 9.5 cm, increased echogenicity (consistent "
            "with CKD), no hydronephrosis. Normal renal vasculature on Doppler."
        ),
        "discussion": (
            "Contrast-induced AKI (CI-AKI) typically peaks 48–72 h post-contrast and "
            "resolves within 7 days in most patients. Risk factors include CKD, diabetes, "
            "dehydration, and high contrast volume. Low FeNa suggests preserved tubular "
            "reabsorption. Prevention with IV normal saline (0.9%) pre- and post-procedure "
            "is the only evidence-based prophylactic measure."
        ),
        "diagnosis": "Contrast-induced acute kidney injury (CI-AKI) on background CKD.",
        "management": (
            "IV 0.9% saline at 1 mL/kg/h for 12 h (ensure euvolaemia). "
            "Withhold metformin, ACE inhibitor, diuretics until Cr returns to baseline. "
            "Avoid nephrotoxins. Daily creatinine monitoring. Fluid balance chart. "
            "Haemodialysis only if refractory hyperkalaemia, acidosis, or pulmonary oedema. "
            "Nephrology review if AKI does not resolve in 7 days."
        ),
        "chapter_ref": "p09_c307",
    },
    {
        "case_id": "case_nephrology_002",
        "title": "IgA Nephropathy Presenting as Macroscopic Haematuria",
        "specialty": "Nephrology",
        "presentation": (
            "A 22-year-old man presents with painless dark-brown urine starting 24 hours "
            "after an upper respiratory tract infection. He has no past history of "
            "renal disease and is otherwise well."
        ),
        "history": (
            "PMH: recurrent sore throats, no urinary tract infections. No family history "
            "of renal disease. No NSAID use. Non-smoker, occasional alcohol. "
            "University student. No travel history."
        ),
        "physical_exam": (
            "BP 148/92, HR 78, afebrile. Mild bilateral facial puffiness. "
            "No rash, no arthritis, no lymphadenopathy. Pharynx mildly erythematous. "
            "No costovertebral angle tenderness."
        ),
        "labs": (
            "Creatinine: 1.4 mg/dL (normal for age baseline unknown). "
            "UA: 3+ blood, 2+ protein, RBC casts on microscopy. "
            "24 h urine protein: 1.8 g. Complement (C3, C4): normal. "
            "ANA, ANCA, anti-GBM: negative. IgA level: elevated (480 mg/dL)."
        ),
        "imaging": (
            "Renal ultrasound: normal-sized kidneys bilaterally, no hydronephrosis. "
            "No renal calculi."
        ),
        "discussion": (
            "IgA nephropathy (Berger's disease) is the most common primary "
            "glomerulonephritis worldwide. The characteristic synpharyngitic haematuria "
            "(macroscopic haematuria concurrent with mucosal infection) helps distinguish "
            "it from post-streptococcal GN (which occurs 1–3 weeks after infection). "
            "Renal biopsy showing mesangial IgA deposits on immunofluorescence is diagnostic."
        ),
        "diagnosis": "IgA nephropathy (Berger's disease) presenting with synpharyngitic macroscopic haematuria.",
        "management": (
            "Renal biopsy for definitive diagnosis and prognostication. "
            "Optimise BP: target <130/80 (ACE inhibitor first-line for anti-proteinuric effect). "
            "If proteinuria persists >1 g/day despite RAS blockade: consider fish oil or "
            "targeted-release budesonide (NEFIGAN protocol). Avoid NSAIDs. "
            "Nephrology follow-up with serial Cr, BP, urine protein monitoring."
        ),
        "chapter_ref": "p09_c304",
    },
    # ── Gastroenterology (Part 10) ───────────────────────────────────────────
    {
        "case_id": "case_gastroenterology_001",
        "title": "Acute Variceal Haemorrhage in a Cirrhotic Patient",
        "specialty": "Gastroenterology",
        "presentation": (
            "A 52-year-old man with known alcohol-related cirrhosis presents by ambulance "
            "with two episodes of haematemesis (bright red blood) and melaena. "
            "He is confused and hypotensive on arrival."
        ),
        "history": (
            "PMH: Child-Pugh C cirrhosis, prior variceal band ligation 18 months ago, "
            "alcohol use disorder (>80 g/day). Medications: propranolol 40 mg BD "
            "(non-selective beta-blocker for portal hypertension), lactulose, thiamine. "
            "Social: lives alone, poor compliance."
        ),
        "physical_exam": (
            "BP 78/50, HR 128, RR 22, SpO2 96%, T 37.5°C. GCS 13 (E3V4M6). "
            "Icteric sclerae. Spider naevi (8). Caput medusae. Tense ascites. "
            "Splenomegaly. No peripheral oedema. Rectal exam: melaena."
        ),
        "labs": (
            "Hgb 6.2 g/dL. Platelets 68,000. INR 2.4. Creatinine 1.8. "
            "Bilirubin 4.6 mg/dL. Albumin 2.0 g/dL. ALT/AST: mildly elevated. "
            "Lactate 4.1 mmol/L. Blood cultures: pending."
        ),
        "imaging": (
            "CXR: clear. FAST ultrasound: large volume ascites. "
            "Urgent endoscopy: large oesophageal varices with active spurting haemorrhage "
            "at the GOJ; four bands applied."
        ),
        "discussion": (
            "Acute variceal haemorrhage carries 6-week mortality of 15–20%. "
            "Vasoactive drugs (terlipressin, octreotide) reduce portal pressure and should "
            "be given before endoscopy. Prophylactic antibiotics (ceftriaxone) reduce "
            "infection risk and mortality. Transfusion target Hgb 7–8 g/dL (restrictive "
            "strategy) to avoid portal pressure rise. TIPS if endoscopic treatment fails."
        ),
        "diagnosis": "Acute oesophageal variceal haemorrhage in decompensated alcoholic cirrhosis (Child-Pugh C).",
        "management": (
            "Resuscitate: 2 large-bore IV cannulas, type and crossmatch, 0.9% saline to "
            "MAP >65. Terlipressin 2 mg IV stat. Ceftriaxone 1 g IV. "
            "Urgent endoscopy (EVL) after stabilisation. Target Hgb 7–8 g/dL with pRBC. "
            "FFP/platelets if active bleeding with coagulopathy. "
            "Secondary prophylaxis post-discharge: NSBB + serial EVL until varices eradicated."
        ),
        "chapter_ref": "p10_c361",
    },
    {
        "case_id": "case_gastroenterology_002",
        "title": "Clostridium difficile Colitis Following Antibiotic Therapy",
        "specialty": "Gastroenterology",
        "presentation": (
            "A 75-year-old woman develops profuse watery diarrhoea (8 bowel movements per day) "
            "and lower abdominal cramping 5 days after completing a course of ciprofloxacin "
            "for a urinary tract infection."
        ),
        "history": (
            "PMH: T2DM, hypertension, CKD stage 2. Recent hospitalisation 3 weeks ago "
            "for hip fracture. Medications: metformin, amlodipine, omeprazole. "
            "Lives in a residential care home."
        ),
        "physical_exam": (
            "BP 100/68, HR 105, T 38.4°C, RR 18. Dehydrated (dry mucous membranes). "
            "Abdomen: diffuse tenderness, no guarding or rigidity. "
            "Hyperactive bowel sounds. No peritoneal signs."
        ),
        "labs": (
            "WBC 22,000/µL. Creatinine 1.8 (baseline 1.2). "
            "Stool PCR/toxin EIA: positive for C. difficile toxin A and B. "
            "Albumin 2.8 g/dL. Lactate: 1.4 mmol/L. CT abdomen: colonic wall thickening "
            "throughout, no perforation."
        ),
        "imaging": (
            "CT abdomen/pelvis with contrast: pancolitis with colonic wall thickening and "
            "pericolonic fat stranding. No free air. No megacolon (max colonic diameter 5.2 cm)."
        ),
        "discussion": (
            "C. difficile infection (CDI) is diagnosed by positive toxin EIA or PCR plus "
            "clinical symptoms. Severity grading: mild-moderate (WBC <15,000), severe "
            "(WBC ≥15,000 or creatinine ≥1.5× baseline). This patient has severe CDI. "
            "Fidaxomicin is now preferred over vancomycin for initial severe CDI due to "
            "lower recurrence rates. Metronidazole is no longer first-line for severe disease."
        ),
        "diagnosis": "Severe Clostridioides difficile infection (CDI) following fluoroquinolone therapy.",
        "management": (
            "Oral vancomycin 125 mg QID × 10 days (or fidaxomicin 200 mg BD × 10 days). "
            "Discontinue offending antibiotics if possible. Fluid and electrolyte "
            "replacement. Contact isolation (gloves, gown). Hand hygiene (soap and water — "
            "alcohol gel ineffective against spores). Review PPI use. "
            "Surgery consult if megacolon or perforation develops."
        ),
        "chapter_ref": "p10_c135",
    },
    {
        "case_id": "case_gastroenterology_003",
        "title": "Crohn's Disease Presenting with Ileocolonic Involvement",
        "specialty": "Gastroenterology",
        "presentation": (
            "A 26-year-old woman presents with a 6-month history of right lower quadrant "
            "pain, non-bloody diarrhoea (5–6 per day), 6 kg weight loss, and fatigue. "
            "She also has a perianal fistula."
        ),
        "history": (
            "Family history: brother with Crohn's disease. No NSAID use. Non-smoker. "
            "Medications: none. No prior surgery. Previous appendicectomy ruled out on history."
        ),
        "physical_exam": (
            "BMI 17.5. T 37.8°C, HR 90, BP 118/76. Pale. "
            "RLQ tenderness with palpable fullness. No guarding. "
            "Perianal examination: complex fistula-in-ano with external opening."
        ),
        "labs": (
            "CRP: 64 mg/L. ESR: 55 mm/h. Hgb 10.2 (normocytic). "
            "Albumin 28 g/L. Fe/ferritin: low. B12, folate: normal. "
            "Faecal calprotectin: 1,800 µg/g (markedly elevated). "
            "Stool cultures: negative. C. diff: negative."
        ),
        "imaging": (
            "MRI enterography: transmural inflammation of terminal ileum and ascending "
            "colon; skip lesions; creeping fat; no abscess. "
            "MRI pelvis: complex transsphincteric fistula. "
            "Colonoscopy: cobblestone mucosa, skip lesions, deep ulcers; "
            "biopsy: non-caseating granulomas."
        ),
        "discussion": (
            "Crohn's disease is characterised by transmural, granulomatous inflammation "
            "that can affect any segment of the GI tract from mouth to anus, with skip "
            "lesions. Perianal disease occurs in 25–35% and is more common in colonic "
            "involvement. The Montreal classification (location + behaviour) guides therapy. "
            "Biologic therapy (anti-TNF ± immunomodulator) is recommended for moderate-severe "
            "or fistulising disease."
        ),
        "diagnosis": "Crohn's disease, ileocolonic, active moderate-severe, with perianal fistula (Montreal A2 L3 B3p).",
        "management": (
            "Induction: prednisolone 40 mg daily tapering over 8 weeks. "
            "Maintenance: infliximab (or adalimumab) + azathioprine (combination more "
            "effective than monotherapy). Seton placement for complex perianal fistula "
            "(colorectal surgery). Nutritional support (elemental feeding if needed). "
            "Iron supplementation. Bone protection with vitamin D/calcium on steroids."
        ),
        "chapter_ref": "p10_c330",
    },
    # ── Endocrinology (Part 12) ──────────────────────────────────────────────
    {
        "case_id": "case_endocrinology_001",
        "title": "Diabetic Ketoacidosis in a 19-Year-Old with New T1DM",
        "specialty": "Endocrinology",
        "presentation": (
            "A 19-year-old man is brought to the ED with a 3-day history of polyuria, "
            "polydipsia, nausea, and vomiting. He is now drowsy and has Kussmaul breathing."
        ),
        "history": (
            "No known past medical history. Family history: aunt with type 1 diabetes. "
            "No medications. No recent infection. No alcohol or drug use. "
            "Lost 8 kg over the past 2 months."
        ),
        "physical_exam": (
            "BP 96/60, HR 122, RR 28 (deep, sighing), T 36.8°C. GCS 13. "
            "Dry mucous membranes, sunken eyes, decreased skin turgor — moderate-severe "
            "dehydration. Fruity breath odour. Abdominal tenderness (diffuse, non-specific)."
        ),
        "labs": (
            "Glucose: 38.4 mmol/L (692 mg/dL). ABG: pH 7.14, HCO3 8, PaCO2 18 — "
            "high anion gap metabolic acidosis (HAGMA). Ketones: 5.4 mmol/L (strongly +ve). "
            "Na 129 (corrected 137), K 5.8 (total body K depleted), Cr 1.6 (pre-renal). "
            "HbA1c: 13.2%. Anti-GAD, anti-islet cell antibodies: positive."
        ),
        "imaging": (
            "CXR: no infective focus. ECG: sinus tachycardia, peaked T waves (hyperkalaemia)."
        ),
        "discussion": (
            "DKA results from absolute insulin deficiency (T1DM) or relative deficiency "
            "(T2DM under stress). The triad: hyperglycaemia + ketonaemia + metabolic acidosis. "
            "Despite serum hyperkalaemia, total body potassium is severely depleted — "
            "potassium falls precipitously once insulin is given. Cerebral oedema is the "
            "most feared complication, particularly in children."
        ),
        "diagnosis": "Diabetic ketoacidosis (DKA) as first presentation of type 1 diabetes mellitus.",
        "management": (
            "IV 0.9% saline: 1 L over 1 h, then guided by fluid status. "
            "Insulin: fixed-rate IV insulin infusion (0.1 u/kg/h). "
            "Potassium replacement: once K+ <5.5 mEq/L and urine output established. "
            "Monitor: hourly glucose, 2-hourly VBG/ketones until resolving DKA "
            "(pH >7.3, ketones <0.3, HCO3 >15). Identify and treat precipitant. "
            "Diabetes education and insulin regimen post-resolution."
        ),
        "chapter_ref": "p12_c383",
    },
    {
        "case_id": "case_endocrinology_002",
        "title": "Primary Hyperaldosteronism in a Patient with Resistant Hypertension",
        "specialty": "Endocrinology",
        "presentation": (
            "A 44-year-old woman is referred for persistent hypertension despite being on "
            "three antihypertensive agents including a diuretic. She also mentions "
            "muscle cramps and fatigue."
        ),
        "history": (
            "PMH: hypertension diagnosed at age 36 (unusually young). "
            "Medications: amlodipine 10 mg, ramipril 10 mg, hydrochlorothiazide 25 mg. "
            "No family history of hypertension or endocrine tumours. Non-smoker, light drinker."
        ),
        "physical_exam": (
            "BP 172/104 (right arm), HR 70. No Cushingoid features. No abdominal bruit. "
            "No oedema. Normal fundoscopy."
        ),
        "labs": (
            "K+ 2.8 mEq/L (hypokalaemia). Renin activity: 0.3 ng/mL/h (suppressed). "
            "Aldosterone: 36 ng/dL. Aldosterone-to-renin ratio (ARR): 120 (normal <30). "
            "Urine K+ excretion: 40 mEq/day (inappropriate kaliuresis). "
            "Cortisol/dexamethasone suppression: normal."
        ),
        "imaging": (
            "CT adrenal: 1.8 cm left adrenal adenoma (Hounsfield units 8 — lipid-rich). "
            "Adrenal vein sampling: left-to-right aldosterone ratio 12:1 (lateralising)."
        ),
        "discussion": (
            "Primary hyperaldosteronism (Conn's syndrome) is the most common cause of "
            "secondary hypertension (5–10% of hypertension clinic patients). Key features: "
            "hypokalaemia, suppressed renin, elevated aldosterone, and high ARR. "
            "Adrenal vein sampling (AVS) is essential to distinguish unilateral adenoma "
            "(surgical candidate) from bilateral adrenal hyperplasia (medical management)."
        ),
        "diagnosis": "Primary hyperaldosteronism (Conn's syndrome) due to left adrenal aldosterone-producing adenoma.",
        "management": (
            "Unilateral adenoma: laparoscopic left adrenalectomy. "
            "Pre-operatively: spironolactone (aldosterone antagonist) to normalise K+ and BP. "
            "Post-operatively: monitor BP and K+ (may take months to normalise). "
            "If bilateral hyperplasia: medical management with spironolactone or eplerenone long-term."
        ),
        "chapter_ref": "p12_c390",
    },
    # ── Neurology (Part 13) ──────────────────────────────────────────────────
    {
        "case_id": "case_neurology_001",
        "title": "Guillain-Barré Syndrome Following GI Infection",
        "specialty": "Neurology",
        "presentation": (
            "A 35-year-old man presents with progressive bilateral leg weakness that "
            "began in his feet 5 days ago and has now ascended to his thighs. He also "
            "reports tingling in his hands and feet. He had gastroenteritis 2 weeks ago."
        ),
        "history": (
            "PMH: nil. No chronic medications. No family history of neuromuscular disease. "
            "Recent illness: 4 days of diarrhoea 2 weeks ago (culture: Campylobacter jejuni)."
        ),
        "physical_exam": (
            "BP 124/78 (postural drop 20 mmHg), HR 95 and regular. "
            "Lower limb power: 3/5 proximal and distal bilaterally. "
            "Upper limb power: 4+/5. All deep tendon reflexes: absent. "
            "Sensory: reduced vibration sense distally. Cranial nerves: intact. "
            "No papilloedema."
        ),
        "labs": (
            "CSF: protein 2.1 g/L (elevated), WBC 3 (albuminocytological dissociation). "
            "Nerve conduction studies: absent F waves, prolonged distal latencies, "
            "reduced CMAP amplitudes — demyelinating pattern. "
            "Anti-ganglioside antibodies: anti-GM1 positive. "
            "CBC, electrolytes: normal."
        ),
        "imaging": (
            "MRI spine: nerve root enhancement (cauda equina) on gadolinium — consistent "
            "with GBS. No cord compression. CXR: clear."
        ),
        "discussion": (
            "Guillain-Barré syndrome (GBS) is an acute immune-mediated polyneuropathy "
            "triggered by preceding infection (Campylobacter most common). "
            "Classic AIDP (acute inflammatory demyelinating polyneuropathy) presents with "
            "ascending weakness and areflexia. Albuminocytological dissociation (high CSF "
            "protein, normal cell count) is characteristic. FVC monitoring is critical as "
            "30% require ventilatory support."
        ),
        "diagnosis": "Guillain-Barré syndrome (AIDP variant) post-Campylobacter infection.",
        "management": (
            "IVIG 0.4 g/kg/day × 5 days OR plasmapheresis (equally effective, not combined). "
            "Respiratory monitoring: FVC twice daily; intubate if FVC <20 mL/kg or "
            "20/30/40 rule (FVC <20, MIP <30, MEP <40). "
            "DVT prophylaxis. Physiotherapy. Pain management (gabapentin, opioids). "
            "Autonomic monitoring. Rehabilitation post-recovery (most improve over months)."
        ),
        "chapter_ref": "p13_c439",
    },
    {
        "case_id": "case_neurology_002",
        "title": "Multiple Sclerosis Presenting with Optic Neuritis",
        "specialty": "Neurology",
        "presentation": (
            "A 28-year-old woman presents with 5 days of painful visual loss in the "
            "right eye, worse with eye movement. She denies diplopia. She mentions "
            "an episode of numbness in her left leg lasting 3 weeks, 18 months ago, "
            "which resolved spontaneously."
        ),
        "history": (
            "PMH: nil significant. No medications. Family history: mother with MS. "
            "Non-smoker. Works as a teacher."
        ),
        "physical_exam": (
            "Visual acuity: OD 6/60 (reduced), OS 6/6. "
            "Marcus Gunn pupil (relative afferent pupillary defect, RAPD) in right eye. "
            "Fundoscopy: mild right optic disc swelling. "
            "Colour vision (Ishihara): markedly impaired OD. "
            "Neurological: upper motor neuron signs in left leg (brisk reflexes, upgoing plantar)."
        ),
        "labs": (
            "VEP: prolonged P100 latency right eye. "
            "CSF: oligoclonal bands (positive), IgG index elevated. "
            "MRI brain/spine: 4 periventricular white matter lesions (Dawson's fingers) + "
            "one juxtacortical lesion; one enhancing cord lesion at C4. "
            "AQP4-IgG: negative. MOG-IgG: negative."
        ),
        "imaging": (
            "MRI brain with gadolinium: multiple periventricular T2/FLAIR hyperintensities "
            "with Dawson's fingers appearance; one lesion shows gadolinium enhancement "
            "(active demyelination). Spinal cord: T2 lesion at C4 (previous episode)."
        ),
        "discussion": (
            "MS is diagnosed using McDonald criteria 2017: dissemination in space (DIS) "
            "and dissemination in time (DIT). This patient meets both: multiple anatomical "
            "locations (optic nerve, brain, cord) and two separate attacks. "
            "Relapsing-remitting MS (RRMS) is the most common phenotype. "
            "Disease-modifying therapy (DMT) should be started promptly to reduce relapse "
            "rate and prevent disability accumulation."
        ),
        "diagnosis": "Multiple sclerosis (relapsing-remitting), presenting with optic neuritis (McDonald criteria fulfilled).",
        "management": (
            "Acute optic neuritis: IV methylprednisolone 1 g/day × 3 days (speeds recovery). "
            "DMT selection based on disease activity: moderate efficacy (interferon-beta, "
            "glatiramer acetate, dimethyl fumarate) vs high efficacy (natalizumab, "
            "alemtuzumab, ocrelizumab) for active disease. "
            "Ophthalmology review. Physiotherapy. Fatigue management. "
            "Vitamin D supplementation."
        ),
        "chapter_ref": "p13_c436",
    },
    {
        "case_id": "case_neurology_003",
        "title": "Bacterial Meningitis in a 21-Year-Old University Student",
        "specialty": "Neurology",
        "presentation": (
            "A 21-year-old university student is brought to the ED at 2 AM by friends "
            "with severe headache, photophobia, neck stiffness, and a non-blanching "
            "petechial rash on his legs and torso. He has had fever for 12 hours."
        ),
        "history": (
            "PMH: nil. Lives in university halls of residence. No prior vaccinations "
            "for meningococcus. No sick contacts identified."
        ),
        "physical_exam": (
            "T 39.8°C, HR 136, BP 88/54, RR 24, SpO2 97%. GCS 11 (E3V4M4). "
            "Neck: nuchal rigidity. Positive Kernig's and Brudzinski's signs. "
            "Skin: diffuse non-blanching petechiae and purpura (purpura fulminans pattern). "
            "Fundoscopy: no papilloedema."
        ),
        "labs": (
            "WBC 22,000 (neutrophilia). CRP: 320 mg/L. PCT: 12 µg/L. "
            "Coagulation: PT 18, APTT 42, fibrinogen 1.1 (DIC pattern). "
            "Blood cultures: Gram-negative diplococci. "
            "CSF (after CT — no herniation): turbid, protein 3.2, glucose 1.1 "
            "(plasma 5.4), WBC 2,800 (predominantly neutrophils)."
        ),
        "imaging": (
            "CT head (pre-LP): no mass lesion, no midline shift, no cerebral oedema. "
            "MRI brain (post-stabilisation): leptomeningeal enhancement on gadolinium."
        ),
        "discussion": (
            "Meningococcal meningitis/septicaemia (Neisseria meningitidis) is a medical "
            "emergency. The triad of headache, photophobia, and neck stiffness is classic "
            "but not always complete. Non-blanching rash is pathognomonic of meningococcaemia. "
            "Do NOT delay antibiotics for CT or LP. DIC complicates severe disease. "
            "Case fatality rate without treatment: 70–80%."
        ),
        "diagnosis": "Meningococcal meningitis and septicaemia (Neisseria meningitidis) with DIC.",
        "management": (
            "Immediate IV ceftriaxone 2 g stat (do not delay for LP or CT). "
            "Dexamethasone 0.15 mg/kg IV QID × 4 days (reduces hearing loss/neurological sequelae). "
            "Aggressive fluid resuscitation (30 mL/kg crystalloid bolus). "
            "FFP/cryoprecipitate for DIC. ICU transfer. "
            "Notify public health; close contacts: prophylaxis with rifampicin or ciprofloxacin. "
            "Meningococcal ACWY and B vaccination."
        ),
        "chapter_ref": "p16_c143",
    },
    # ── Infectious Disease (Part 16) ─────────────────────────────────────────
    {
        "case_id": "case_infectious_disease_001",
        "title": "HIV Infection Presenting as Pneumocystis Pneumonia",
        "specialty": "Infectious Disease",
        "presentation": (
            "A 34-year-old man presents with a 3-week history of progressive dyspnoea "
            "on exertion, dry cough, and low-grade fevers. He has lost 12 kg over the "
            "past 4 months. He has never been tested for HIV."
        ),
        "history": (
            "MSM (men who sex with men). Multiple sexual partners, inconsistent condom use. "
            "No IV drug use. No prior STI screen. Last dental visit 3 years ago. "
            "Non-smoker. No medications. No travel history."
        ),
        "physical_exam": (
            "T 38.3°C, HR 108, RR 24, SpO2 88% on room air. Cachectic. "
            "Oral thrush (white plaques on buccal mucosa). "
            "Lung: fine bibasal crackles. No lymphadenopathy. No hepatosplenomegaly."
        ),
        "labs": (
            "HIV-1/2 antigen/antibody combo: positive. CD4 count: 48 cells/µL. "
            "HIV VL: 450,000 copies/mL. BAL PCR: Pneumocystis jirovecii positive. "
            "LDH: 480 U/L. ABG: PaO2 54 mmHg (room air). "
            "Beta-D-glucan: markedly elevated. CMV PCR: negative. TB IGRA: negative."
        ),
        "imaging": (
            "CXR: bilateral diffuse granular perihilar infiltrates (bat-wing pattern). "
            "HRCT chest: bilateral ground-glass opacification, no consolidation, no effusion."
        ),
        "discussion": (
            "PCP (Pneumocystis jirovecii pneumonia) is the most common AIDS-defining illness "
            "in developed countries at CD4 <200 cells/µL. Classic triad: sub-acute dyspnoea, "
            "dry cough, fever. LDH is typically elevated. BAL PCR is diagnostic. "
            "Adjunctive corticosteroids are indicated if PaO2 <70 mmHg or A-a gradient >35 "
            "to reduce mortality."
        ),
        "diagnosis": "Pneumocystis jirovecii pneumonia (PCP) as AIDS-defining illness in newly diagnosed HIV (CD4 48 cells/µL).",
        "management": (
            "Co-trimoxazole (TMP-SMX): 15–20 mg/kg/day trimethoprim component IV × 21 days. "
            "Prednisolone 40 mg BD × 5 days then taper (adjunctive, for PaO2 <70 mmHg). "
            "Supplemental O2 (target SpO2 >95%). "
            "Start ART: defer 2 weeks in PCP (earlier ART associated with higher IRIS risk). "
            "Primary prophylaxis (TMP-SMX) until CD4 >200 on ART. "
            "STI screening, partner notification, hepatitis B/C serology."
        ),
        "chapter_ref": "p16_c197",
    },
    {
        "case_id": "case_infectious_disease_002",
        "title": "Infective Endocarditis in an IV Drug User",
        "specialty": "Infectious Disease",
        "presentation": (
            "A 28-year-old man who injects heroin presents with 2 weeks of fever, rigors, "
            "and right-sided pleuritic chest pain. He has multiple track marks on his arms."
        ),
        "history": (
            "Active IV heroin use (daily). Prior admission for skin abscess 6 months ago. "
            "No known cardiac history. No current medications. "
            "Homeless. HCV antibody positive (untreated)."
        ),
        "physical_exam": (
            "T 39.1°C, HR 118, BP 108/68. Unwell appearing. "
            "Track marks and healed skin abscesses on bilateral antecubital fossae. "
            "Heart: Grade 3/6 pansystolic murmur at left sternal border, louder on inspiration. "
            "Lungs: scattered crackles at right base. "
            "Splenomegaly. No Janeway lesions or Osler nodes (rarely present early)."
        ),
        "labs": (
            "WBC 18,000 (neutrophilia). CRP 240 mg/L. Hgb 9.8 (anaemia of chronic disease). "
            "Blood cultures ×3 (before antibiotics): Staphylococcus aureus (MSSA). "
            "Creatinine 1.1. LFTs: mildly elevated. HIV test: negative."
        ),
        "imaging": (
            "Echocardiogram (TOE): large 2.1 cm vegetation on tricuspid valve, "
            "moderate tricuspid regurgitation. No aortic/mitral involvement. "
            "CT chest: multiple bilateral septic pulmonary emboli with cavitation."
        ),
        "discussion": (
            "Right-sided endocarditis (tricuspid valve most common) accounts for 5–10% "
            "of IE and is strongly associated with IV drug use. S. aureus is the dominant "
            "organism. Modified Duke criteria (major: positive blood cultures ×2, positive echo; "
            "minor: fever, predisposing condition) guide diagnosis. "
            "Right-sided IE has lower mortality than left-sided (10% vs 20–25%) as septic "
            "emboli go to lungs rather than systemic circulation."
        ),
        "diagnosis": "Right-sided infective endocarditis (tricuspid valve) due to MSSA in an IV drug user.",
        "management": (
            "IV flucloxacillin 2 g every 4 h × 4–6 weeks (MSSA). "
            "Repeat blood cultures 48–72 h after antibiotics. "
            "Cardiology + cardiac surgery joint review. "
            "Surgery indications: refractory sepsis, vegetation >20 mm, recurrent emboli. "
            "Addiction medicine referral: opioid substitution therapy. "
            "HCV treatment referral. Dental review."
        ),
        "chapter_ref": "p16_c155",
    },
    {
        "case_id": "case_infectious_disease_003",
        "title": "Septic Arthritis of the Knee in an Elderly Patient",
        "specialty": "Infectious Disease",
        "presentation": (
            "An 80-year-old woman with rheumatoid arthritis on methotrexate and "
            "low-dose prednisolone presents with a 2-day history of acute painful "
            "swelling of the right knee. She is febrile and unable to weight-bear."
        ),
        "history": (
            "PMH: RA (10 years), T2DM, prior right knee osteoarthritis. "
            "Medications: methotrexate 15 mg weekly, prednisolone 5 mg, folic acid. "
            "No recent knee injection. No recent skin break."
        ),
        "physical_exam": (
            "T 38.6°C, HR 102, BP 122/78. Right knee: markedly swollen, warm, erythematous, "
            "tense effusion (ballottement positive), restricted range of motion (0–30°). "
            "Left knee: mild chronic changes only. Skin: intact, no cellulitis."
        ),
        "labs": (
            "WBC 14,800 (neutrophilia). CRP: 186 mg/L. Uric acid: 5.2 (normal). "
            "Synovial fluid (joint aspiration): WBC 82,000/µL (>90% PMNs), "
            "Gram-positive cocci in clusters. No crystals. "
            "Culture: Staphylococcus aureus (MRSA). Blood cultures: ×2 negative."
        ),
        "imaging": (
            "Plain X-ray right knee: joint space preserved, no chondrocalcinosis, "
            "soft tissue swelling. "
            "MRI right knee: large joint effusion, synovial enhancement, no osteomyelitis."
        ),
        "discussion": (
            "Septic arthritis is a medical-surgical emergency; delayed treatment leads to "
            "cartilage destruction within 24–48 h. Risk factors: RA, immunosuppression, "
            "prosthetic joints, DM. S. aureus accounts for >50% of cases. "
            "Immunosuppressed patients may have attenuated fever/inflammatory markers. "
            "Joint fluid WBC >50,000 with neutrophilia strongly suggests infection "
            "(vs crystal arthropathy WBC 20,000–100,000)."
        ),
        "diagnosis": "Septic arthritis of the right knee due to MRSA in an immunosuppressed patient.",
        "management": (
            "Urgent joint washout (arthroscopic or open) + daily aspiration if washout "
            "not immediately available. "
            "IV vancomycin (MRSA coverage) — dose per trough/AUC monitoring. "
            "Withhold methotrexate during acute infection. "
            "Orthopaedics + ID co-management. Total 4–6 weeks IV antibiotics. "
            "Physiotherapy to prevent ankylosis post-treatment."
        ),
        "chapter_ref": "p16_c160",
    },
    # ── Hematology (Part 5) ──────────────────────────────────────────────────
    {
        "case_id": "case_hematology_001",
        "title": "Immune Thrombocytopenic Purpura in a Young Woman",
        "specialty": "Hematology",
        "presentation": (
            "A 24-year-old woman presents with a 1-week history of scattered petechiae "
            "on her lower legs and spontaneous gum bleeding. She had a viral upper "
            "respiratory infection 2 weeks ago. No other bleeding history."
        ),
        "history": (
            "PMH: nil. No medications (no NSAIDs, no heparin). No family history of "
            "bleeding disorders. No history of thrombosis. Menstrual periods: regular, "
            "recently heavier. Non-smoker."
        ),
        "physical_exam": (
            "BP 112/72, HR 82, afebrile. Petechiae and purpura on bilateral lower limbs. "
            "No lymphadenopathy. No splenomegaly. No hepatomegaly. "
            "No joint haemarthroses. Gingival oozing noted."
        ),
        "labs": (
            "Platelets: 8,000/µL. WBC: 7,200 (normal differential). Hgb: 11.8 g/dL. "
            "Peripheral blood film: decreased platelets, no platelet clumping, "
            "no schistocytes, no blast cells. "
            "ADAMTS13: normal (excludes TTP). PT/APTT: normal. "
            "H. pylori serology: negative. HIV, HCV, HBsAg: negative. ANA: negative."
        ),
        "imaging": (
            "Bone marrow biopsy not indicated initially (no cytopenias in other cell lines). "
            "Ultrasound abdomen: normal spleen size, no lymphadenopathy."
        ),
        "discussion": (
            "Immune thrombocytopenic purpura (ITP) is a diagnosis of exclusion — isolated "
            "thrombocytopenia with no identifiable cause after ruling out other conditions. "
            "Secondary causes must be excluded (drug-induced, HIV, HCV, SLE). "
            "Treatment threshold: platelets <30,000/µL with bleeding OR <20,000/µL "
            "in asymptomatic patients (risk of spontaneous ICH)."
        ),
        "diagnosis": "Primary immune thrombocytopenic purpura (ITP) — newly diagnosed, severe (platelets 8,000/µL).",
        "management": (
            "First-line: prednisolone 1 mg/kg/day × 4 weeks then taper. "
            "If urgent rise needed (active bleeding, procedure): IVIG 1 g/kg × 1–2 days. "
            "Avoid NSAIDs, anticoagulants. Menstrual suppression (norethisterone). "
            "Refractory ITP: thrombopoietin receptor agonists (romiplostim, eltrombopag) "
            "or rituximab. Splenectomy for chronic refractory ITP."
        ),
        "chapter_ref": "p05_c111",
    },
    {
        "case_id": "case_hematology_002",
        "title": "Sickle Cell Crisis with Acute Chest Syndrome",
        "specialty": "Hematology",
        "presentation": (
            "A 22-year-old man with known sickle cell disease (HbSS) presents with "
            "severe bilateral leg pain and chest pain that has developed over the last "
            "6 hours. He is tachypnoeic and hypoxic."
        ),
        "history": (
            "PMH: HbSS diagnosed at birth (neonatal screen), 3 prior hospitalisations "
            "for vaso-occlusive crises. Not on hydroxyurea. Medications: folic acid. "
            "Vaccinated (pneumococcal, Hib, meningococcal). Social: university student."
        ),
        "physical_exam": (
            "T 38.5°C, HR 122, BP 104/68, RR 28, SpO2 88% on room air. "
            "Icteric. Bilateral leg pain on palpation. "
            "Chest: dull to percussion at both bases, bronchial breathing right base. "
            "Abdomen: mild hepatomegaly, spleen not palpable (autosplenectomy)."
        ),
        "labs": (
            "Hgb 6.1 g/dL (baseline 8.5). Reticulocyte count 12%. "
            "WBC 18,000 (leukocytosis). Platelets 480,000. "
            "LDH 620 U/L. Bilirubin 4.1 (unconjugated). "
            "Blood film: sickle cells, target cells, nucleated RBCs. "
            "Blood cultures: pending."
        ),
        "imaging": (
            "CXR: new bilateral lower lobe infiltrates — consistent with acute chest syndrome. "
            "Echo: normal LV function, mild pulmonary hypertension (RVSP 38 mmHg)."
        ),
        "discussion": (
            "Acute chest syndrome (ACS) is defined by a new pulmonary infiltrate + "
            "respiratory symptoms (chest pain, fever, wheeze, cough, hypoxia). "
            "ACS is the leading cause of death in sickle cell disease. "
            "Triggers include infection, fat embolism, and pulmonary vaso-occlusion. "
            "Exchange transfusion (not simple transfusion) is preferred for severe ACS "
            "to reduce HbS% rapidly while avoiding hyperviscosity."
        ),
        "diagnosis": "Acute chest syndrome complicating vaso-occlusive crisis in HbSS sickle cell disease.",
        "management": (
            "High-flow O2 (target SpO2 >95%). IV morphine PCA for pain. "
            "IV fluids (avoid fluid overload). Incentive spirometry. "
            "Empirical antibiotics (ceftriaxone + azithromycin for atypical cover). "
            "Exchange transfusion: target HbS <30%, Hgb 10 g/dL. "
            "Haematology + intensive care review. Post-discharge: start hydroxyurea. "
            "Long-term: consider stem cell transplant evaluation."
        ),
        "chapter_ref": "p05_c099",
    },
    {
        "case_id": "case_hematology_003",
        "title": "Acute Myeloid Leukaemia Presenting with Pancytopenia",
        "specialty": "Hematology",
        "presentation": (
            "A 65-year-old man presents with 4 weeks of fatigue, spontaneous bruising, "
            "and two nosebleeds that were difficult to stop. He also reports a recent "
            "bout of pneumonia treated by his GP."
        ),
        "history": (
            "PMH: myelodysplastic syndrome (MDS) diagnosed 18 months ago (IPSS intermediate-1), "
            "managed conservatively. No prior chemotherapy. "
            "Medications: none. Non-smoker. No occupational chemical/radiation exposure."
        ),
        "physical_exam": (
            "Pale and fatigued. Ecchymoses on upper and lower limbs. "
            "Gingival hypertrophy (gum infiltration — suggests monocytic differentiation). "
            "Splenomegaly (5 cm below costal margin). No lymphadenopathy. "
            "HR 110, BP 114/72, SpO2 96%, afebrile."
        ),
        "labs": (
            "WBC 42,000/µL (58% blasts on differential). Hgb 7.2 g/dL. Platelets 18,000/µL. "
            "Peripheral blood film: circulating blasts with Auer rods. "
            "Bone marrow biopsy: 72% blasts. Cytogenetics: complex karyotype. "
            "Flow cytometry: CD33+, CD117+, HLA-DR+ — AML M4/M5 phenotype. "
            "LDH: 980 U/L. Uric acid: 9.2 mg/dL (tumour lysis risk)."
        ),
        "imaging": (
            "CXR: mild bilateral infiltrates (post-pneumonia resolving). "
            "CT chest/abdomen/pelvis: splenomegaly, no CNS involvement on MRI brain."
        ),
        "discussion": (
            "AML arising from prior MDS (secondary AML) carries a worse prognosis than "
            "de novo AML due to higher frequency of adverse cytogenetics and resistance to "
            "standard induction chemotherapy. Auer rods are pathognomonic of AML. "
            "Complex karyotype confers adverse risk (AML ELN 2022 risk classification). "
            "Allogeneic stem cell transplant in CR1 is the only curative option for "
            "adverse-risk AML in fit patients."
        ),
        "diagnosis": "Secondary acute myeloid leukaemia (sAML) arising from MDS, adverse-risk (complex karyotype).",
        "management": (
            "Induction: 7+3 (cytarabine 100 mg/m²/day × 7 + daunorubicin × 3 days) "
            "OR venetoclax + azacitidine (if ineligible for intensive chemotherapy). "
            "Allopurinol + aggressive IV hydration (tumour lysis prophylaxis). "
            "Broad-spectrum antibiotics if febrile neutropenia develops. "
            "Platelet transfusion: target >10,000/µL (or >20,000 if bleeding). "
            "After CR1: allogeneic SCT workup (donor search initiated)."
        ),
        "chapter_ref": "p05_c103",
    },
    # ── Rheumatology (Part 11) ───────────────────────────────────────────────
    {
        "case_id": "case_023",
        "title": "Systemic Lupus Erythematosus with Lupus Nephritis",
        "specialty": "Rheumatology",
        "presentation": (
            "A 29-year-old woman presents with a 3-month history of facial rash, "
            "joint pain in her hands and wrists, fatigue, and new-onset ankle swelling. "
            "She also reports hair loss and mouth ulcers."
        ),
        "history": (
            "PMH: nil significant. No prior diagnosis of autoimmune disease. "
            "Family history: maternal aunt with lupus. "
            "Medications: ibuprofen PRN (stopped 2 weeks ago). No OCP. Non-smoker. "
            "Recent sun exposure triggered facial rash worsening."
        ),
        "physical_exam": (
            "BP 148/96, HR 84, T 37.6°C, RR 16. "
            "Malar (butterfly) rash sparing nasolabial folds. Discoid lesions on scalp. "
            "Two oral ulcers on hard palate. Mild diffuse alopecia. "
            "Bilateral wrist synovitis, no joint deformity. Bilateral pitting ankle oedema 2+. "
            "No lymphadenopathy. No serositis."
        ),
        "labs": (
            "Hgb 9.4 g/dL (Coombs positive haemolytic anaemia). Platelets 88,000/µL. "
            "WBC 3,100/µL (lymphopenia 800/µL). Creatinine 1.8 mg/dL. "
            "ANA: positive 1:640 (homogeneous pattern). Anti-dsDNA: 480 IU/mL (high positive). "
            "Anti-Sm: positive. Complement: C3 0.48 g/L, C4 0.06 g/L (low). "
            "Urine: 3+ protein, RBC casts. 24 h protein: 3.8 g (nephrotic range). "
            "APLS screen (anticardiolipin, beta-2 GPI): negative."
        ),
        "imaging": (
            "CXR: small bilateral pleural effusions. "
            "Renal biopsy: diffuse proliferative lupus nephritis (Class III/IV ISN/RPS). "
            "Renal ultrasound: bilateral kidneys 10.5 cm, mildly increased echogenicity."
        ),
        "discussion": (
            "SLE is a multisystem autoimmune disease predominantly affecting women of "
            "childbearing age. SLICC 2012 criteria require ≥4 of 11 criteria (or biopsy-proven "
            "lupus nephritis + ANA/anti-dsDNA). Lupus nephritis class III/IV requires "
            "aggressive immunosuppression — untreated it progresses to ESRD. "
            "Low complement and rising anti-dsDNA titres correlate with disease flare."
        ),
        "diagnosis": "Systemic lupus erythematosus with Class III/IV diffuse proliferative lupus nephritis.",
        "management": (
            "Induction: IV methylprednisolone 500 mg × 3 days, then prednisolone 1 mg/kg/day. "
            "Mycophenolate mofetil 3 g/day (or cyclophosphamide Euro-Lupus regimen). "
            "Hydroxychloroquine 400 mg/day (all SLE patients, cardioprotective, anti-flare). "
            "ACE inhibitor for BP and proteinuria. "
            "Maintenance: mycophenolate 1.5–2 g/day + hydroxychloroquine. "
            "Monitor: SLEDAI, renal function, anti-dsDNA, complement q3 months. "
            "Contraception counselling (teratogenic medications)."
        ),
        "chapter_ref": "p11_c356",
    },
    {
        "case_id": "case_024",
        "title": "Rheumatoid Arthritis with Extra-Articular Manifestations",
        "specialty": "Rheumatology",
        "presentation": (
            "A 52-year-old woman presents with a 6-month history of symmetrical swelling "
            "and morning stiffness (>2 hours) in her metacarpophalangeal and proximal "
            "interphalangeal joints. She has lost 5 kg and reports worsening fatigue."
        ),
        "history": (
            "PMH: nil. No family history of RA. Non-smoker (ceased 5 years ago, 15 pack-years). "
            "Medications: naproxen 500 mg BD (partial relief). "
            "No prior DMARD therapy. No prior joint injections."
        ),
        "physical_exam": (
            "Hands: bilateral MCP and PIP synovitis, swan-neck deformity of 3rd PIP (right), "
            "ulnar deviation of MCPs. Wrists: boggy synovitis bilaterally. "
            "Rheumatoid nodules over right olecranon. "
            "Chest: bilateral basal crackles. "
            "Eyes: mild scleral injection. BP 124/78, HR 82, afebrile."
        ),
        "labs": (
            "CRP: 64 mg/L. ESR: 78 mm/h. RF: 320 IU/mL (strongly positive). "
            "Anti-CCP: 480 U/mL (strongly positive — high specificity for RA). "
            "Hgb 10.8 g/dL (normocytic — anaemia of chronic disease). "
            "WBC, platelets: normal. ANA: weakly positive (1:40). "
            "LFTs: ALT 32 (normal). Creatinine: normal. Hepatitis B/C: negative."
        ),
        "imaging": (
            "Hand X-rays: periarticular osteopenia, marginal erosions at 2nd/3rd MCP joints, "
            "joint space narrowing at wrists — Larsen grade II disease. "
            "CXR: bilateral basal fibrosis (early ILD). "
            "HRCT chest: bilateral basal non-specific interstitial pneumonia (NSIP) pattern."
        ),
        "discussion": (
            "RA is a systemic autoimmune arthropathy with extra-articular manifestations in "
            "up to 40% — pulmonary (ILD, pleuritis), ocular (scleritis, episcleritis), "
            "and cardiovascular (accelerated atherosclerosis). High-positive anti-CCP is "
            "highly specific and predicts erosive, progressive disease. Early DMARD therapy "
            "reduces erosion and prevents functional decline — treat-to-target (DAS28 <2.6)."
        ),
        "diagnosis": "Seropositive rheumatoid arthritis (RF+, anti-CCP+), active moderate-severe disease with ILD.",
        "management": (
            "DMARD therapy: methotrexate 15–25 mg/week + folic acid 5 mg/week. "
            "Bridging: prednisolone 15 mg tapering over 8 weeks. "
            "If inadequate response at 3 months: add hydroxychloroquine/sulfasalazine "
            "(triple therapy) or switch to biologic (TNFi — etanercept, adalimumab). "
            "ILD: pulmonology review; avoid methotrexate if significant ILD — use leflunomide. "
            "Cardiovascular risk management (statin, aspirin). Annual eye review."
        ),
        "chapter_ref": "p11_c358",
    },
    {
        "case_id": "case_025",
        "title": "Acute Gouty Arthritis in a Patient with Metabolic Syndrome",
        "specialty": "Rheumatology",
        "presentation": (
            "A 55-year-old man presents at 3 AM with sudden-onset excruciating pain, "
            "swelling, and redness in his right big toe that woke him from sleep. "
            "The pain is so severe he cannot bear the weight of a bed sheet."
        ),
        "history": (
            "PMH: hypertension, type 2 diabetes, obesity (BMI 34). "
            "Three similar episodes over the past 2 years, self-resolving. "
            "Medications: hydrochlorothiazide 25 mg, metformin, amlodipine. "
            "Social: drinks 4–6 beers on weekends, high-red-meat diet."
        ),
        "physical_exam": (
            "T 38.1°C, HR 90, BP 158/96. "
            "Right first MTP joint: exquisitely tender, swollen, warm, erythematous — "
            "cannot tolerate palpation. Full passive dorsiflexion severely limited. "
            "Left olecranon: firm 5 mm tophus. "
            "No other joint involvement. No skin rash."
        ),
        "labs": (
            "Serum uric acid: 9.8 mg/dL. CRP: 88 mg/L. WBC: 13,400/µL (neutrophilia). "
            "Creatinine: 1.4 mg/dL (eGFR 52 — limits NSAID use). "
            "Glucose 148 mg/dL. LFTs: normal. "
            "Joint aspiration (MTP): turbid fluid, WBC 48,000/µL (>90% PMNs), "
            "negatively birefringent needle-shaped monosodium urate crystals under polarised microscopy."
        ),
        "imaging": (
            "X-ray right foot: soft tissue swelling at 1st MTP, 'overhanging edge' erosion "
            "at lateral aspect — consistent with chronic tophaceous gout. "
            "Ultrasound: double contour sign over metatarsal head cartilage (urate crystal deposition)."
        ),
        "discussion": (
            "Acute gout results from monosodium urate crystal deposition in synovial fluid, "
            "triggering NLRP3 inflammasome activation and IL-1β-mediated inflammation. "
            "Polarised microscopy showing negatively birefringent needle crystals is diagnostic. "
            "Thiazide diuretics reduce uric acid excretion and are a common precipitant. "
            "Serum urate may be normal or low during an acute attack. "
            "Urate-lowering therapy (ULT) should not be started during an acute flare."
        ),
        "diagnosis": "Acute gouty arthritis of the right first metatarsophalangeal joint (podagra); chronic tophaceous gout.",
        "management": (
            "Acute flare: colchicine 500 µg BD-TDS (first-line if tolerated; GI side effects). "
            "NSAID if eGFR >50 (naproxen — avoid in this patient). "
            "OR prednisolone 30 mg/day × 5 days (preferred given CKD). "
            "Inter-critical: switch hydrochlorothiazide to losartan (uricosuric). "
            "After flare resolves (≥4 weeks): start allopurinol 50 mg/day, titrate to "
            "target urate <6 mg/dL. Cover with prophylactic colchicine for 6 months. "
            "Lifestyle: alcohol cessation, reduce purine-rich foods, weight loss."
        ),
        "chapter_ref": "p12_c417",
    },
    # ── Oncology (Part 4) ────────────────────────────────────────────────────
    {
        "case_id": "case_026",
        "title": "Non-Small Cell Lung Cancer with Mediastinal Involvement",
        "specialty": "Oncology",
        "presentation": (
            "A 63-year-old man presents with a 3-month history of progressive dyspnoea, "
            "haemoptysis (2–3 teaspoons per episode), and 8 kg unintentional weight loss. "
            "He also reports hoarseness of voice for 6 weeks."
        ),
        "history": (
            "PMH: hypertension, hyperlipidaemia. "
            "Social: 45 pack-year smoking history, still smokes 20/day. "
            "Occupational: 15-year asbestos exposure as a plumber. "
            "No prior malignancy. Medications: amlodipine, atorvastatin."
        ),
        "physical_exam": (
            "Cachectic. T 37.2°C, HR 88, BP 132/82, RR 18, SpO2 94% on room air. "
            "Hoarse voice. Trachea deviated to right. "
            "Left supraclavicular lymphadenopathy (2 cm, firm, non-tender). "
            "Reduced left base air entry, dull to percussion. "
            "No clubbing. No Horner syndrome."
        ),
        "labs": (
            "CBC: Hgb 10.2 g/dL (normocytic), WBC 11,200, platelets normal. "
            "LFTs: ALP 280 U/L (elevated). "
            "Calcium: 2.88 mmol/L (hypercalcaemia — PTHrP-mediated). "
            "CEA: 48 ng/mL. CYFRA 21-1: 18 ng/mL. "
            "Albumin: 28 g/L. LDH: 420 U/L."
        ),
        "imaging": (
            "CT chest/abdomen/pelvis: 5.2 cm left hilar mass with mediastinal invasion, "
            "malignant left pleural effusion, para-aortic lymphadenopathy, no liver metastases. "
            "PET-CT: FDG-avid left hilar primary + mediastinal nodes (N3), no distant metastases. "
            "Bronchoscopy + biopsy: poorly differentiated adenocarcinoma."
        ),
        "discussion": (
            "NSCLC represents 80–85% of all lung cancers; adenocarcinoma is now the most common "
            "histological subtype. Left recurrent laryngeal nerve involvement by mediastinal nodes "
            "causes hoarseness (Ortner syndrome). Molecular testing (EGFR, ALK, ROS1, KRAS G12C, "
            "PD-L1) is mandatory before first-line systemic therapy as it determines treatment. "
            "Stage IIIB (T3N3) disease is usually not resectable; concurrent chemoradiotherapy "
            "with durvalumab consolidation is standard of care."
        ),
        "diagnosis": "Stage IIIB (T3N3M0) left lung adenocarcinoma with mediastinal involvement and malignant pleural effusion.",
        "management": (
            "Molecular profiling: EGFR mutation testing, ALK/ROS1 FISH, PD-L1 IHC, NGS panel. "
            "Concurrent chemoradiotherapy: cisplatin/etoposide + thoracic radiotherapy 60–66 Gy. "
            "Post-chemoradiation: durvalumab 10 mg/kg q2 weeks × 12 months (consolidation). "
            "Drain malignant effusion (pleurodesis if recurrent). "
            "Bisphosphonate for hypercalcaemia. "
            "Palliative care and smoking cessation support. "
            "Restaging CT q3 months."
        ),
        "chapter_ref": "p04_c078",
    },
    {
        "case_id": "case_027",
        "title": "Diffuse Large B-Cell Lymphoma Presenting with B Symptoms",
        "specialty": "Oncology",
        "presentation": (
            "A 58-year-old man presents with 6 weeks of rapidly enlarging right cervical "
            "lymph nodes, drenching night sweats, unintentional 10 kg weight loss, and "
            "intermittent fevers. He also reports progressive right arm swelling."
        ),
        "history": (
            "PMH: nil. No prior lymphoma or haematological malignancy. "
            "No EBV/HIV risk factors. No immunosuppressive medications. "
            "Non-smoker, minimal alcohol. Works as an accountant."
        ),
        "physical_exam": (
            "T 38.4°C, HR 104, BP 118/76, SpO2 97%. "
            "Right cervical chain: matted lymph nodes 4 × 6 cm, firm, non-tender. "
            "Left axilla: 3 cm lymph node. "
            "Right arm: pitting oedema (lymphatic obstruction). "
            "No hepatosplenomegaly on clinical exam. "
            "ECOG performance status: 1."
        ),
        "labs": (
            "WBC 12,400/µL (normal differential). Hgb 10.8 g/dL. Platelets 320,000. "
            "LDH: 840 U/L (>2× ULN). Beta-2 microglobulin: 4.8 mg/L (elevated). "
            "Uric acid: 7.2 mg/dL. CRP: 88 mg/L. "
            "HIV: negative. HBsAg: positive (HBV DNA 2,800 IU/mL). "
            "Lymph node excision biopsy: CD20+, CD10+, BCL-6+, MYC rearrangement, "
            "Ki-67 90% — DLBCL, germinal centre B-cell (GCB) subtype."
        ),
        "imaging": (
            "PET-CT: FDG-avid right cervical, bilateral axillary, mediastinal and para-aortic "
            "nodal disease + splenic involvement — Ann Arbor Stage III-B, IPI score 3 (high-intermediate). "
            "Bone marrow trephine: no marrow involvement. "
            "CT brain: no CNS involvement."
        ),
        "discussion": (
            "DLBCL is the most common aggressive non-Hodgkin lymphoma. B symptoms (fever, "
            "drenching sweats, >10% weight loss) indicate systemic disease. High LDH and "
            "IPI score ≥3 confer high-intermediate/high risk. MYC rearrangement may indicate "
            "double-hit lymphoma (concurrent BCL-2 or BCL-6 rearrangement), which requires "
            "more intensive therapy. HBV reactivation with R-CHOP mandates prophylactic "
            "antiviral therapy."
        ),
        "diagnosis": "Diffuse large B-cell lymphoma (GCB subtype), Stage IIIB, IPI 3, with HBV co-infection.",
        "management": (
            "HBV prophylaxis: entecavir 0.5 mg/day throughout immunochemotherapy and 6–12 months after. "
            "Chemotherapy: R-CHOP-21 × 6 cycles (rituximab, cyclophosphamide, doxorubicin, vincristine, prednisolone). "
            "CNS prophylaxis: intrathecal methotrexate × 4 OR high-dose IV methotrexate (if CNS IPI high). "
            "Interim PET-CT after cycle 3 to assess response. "
            "Granulocyte colony-stimulating factor (G-CSF) support. "
            "Restage with PET-CT after completion; consolidative ASCT if incomplete response."
        ),
        "chapter_ref": "p04_c108",
    },
    {
        "case_id": "case_028",
        "title": "Multiple Myeloma Presenting with Bone Pain and Renal Failure",
        "specialty": "Oncology",
        "presentation": (
            "A 68-year-old woman presents with 4 months of worsening lower back pain, "
            "fatigue, and constipation. Over the past 3 weeks she has developed confusion "
            "and her family reports she appears much weaker."
        ),
        "history": (
            "PMH: osteoporosis (on alendronate), hypertension. "
            "Medications: alendronate, ramipril, calcium/vitamin D. "
            "Family history: no haematological malignancy. "
            "Social: retired, non-smoker."
        ),
        "physical_exam": (
            "Confused (GCS 14). T 36.8°C, HR 96, BP 104/66, RR 16, SpO2 97%. "
            "Pale. Tenderness on percussion of lower thoracic and lumbar spine. "
            "No lymphadenopathy. Mild hepatomegaly. No splenomegaly. "
            "Power 4/5 in both legs (proximal weakness)."
        ),
        "labs": (
            "Hgb 8.2 g/dL (normocytic). WBC: 4,800. Platelets: 142,000. "
            "Calcium: 3.4 mmol/L (severe hypercalcaemia). Creatinine: 3.8 mg/dL (AKI). "
            "Total protein: 98 g/L, albumin: 24 g/L (globulin gap 74 g/L). "
            "Serum protein electrophoresis: IgG-kappa paraprotein 62 g/L. "
            "Beta-2 microglobulin: 9.8 mg/L. LDH: normal. "
            "Urine Bence Jones protein: positive. "
            "Bone marrow biopsy: 68% plasma cells."
        ),
        "imaging": (
            "Skeletal survey: multiple lytic lesions in lumbar vertebrae, pelvis, and skull "
            "('pepper-pot skull'). L2 vertebral fracture on MRI spine (no cord compression). "
            "Whole-body low-dose CT: diffuse lytic lesions, no soft tissue mass."
        ),
        "discussion": (
            "Multiple myeloma is diagnosed by the CRAB criteria: hyperCalcaemia, Renal "
            "failure, Anaemia, Bone lesions. Paraprotein causes direct renal tubular toxicity "
            "(light chain cast nephropathy). Hypercalcaemia results from osteoclast activation "
            "by RANK-L. Risk stratification by ISS stage (beta-2 microglobulin + albumin) "
            "and cytogenetics guides treatment intensity. High-dose melphalan with ASCT remains "
            "standard in transplant-eligible patients."
        ),
        "diagnosis": "Multiple myeloma (IgG-kappa), ISS stage III, with CRAB features (hypercalcaemia, AKI, anaemia, bone disease).",
        "management": (
            "Urgent: IV fluids 3–4 L/day for hypercalcaemia + AKI. "
            "Zoledronic acid 4 mg IV (bisphosphonate — after renal recovery, target Cr <3). "
            "Dexamethasone 40 mg/day × 4 days (rapidly reduces myeloma burden and Ca²⁺). "
            "Induction: VRd (bortezomib + lenalidomide + dexamethasone) × 4 cycles. "
            "Stem cell mobilisation + high-dose melphalan + ASCT (if eligible). "
            "Maintenance: lenalidomide until progression. "
            "Supportive: transfusion, G-CSF, antiviral prophylaxis (aciclovir — bortezomib → VZV risk)."
        ),
        "chapter_ref": "p04_c111",
    },
    # ── Additional Cardiology ────────────────────────────────────────────────
    {
        "case_id": "case_029",
        "title": "Acute Decompensated Heart Failure (HFrEF) in a Hypertensive Patient",
        "specialty": "Cardiology",
        "presentation": (
            "A 71-year-old man with known ischaemic heart failure (EF 32%) presents "
            "with 5 days of worsening dyspnoea, orthopnoea (unable to sleep flat), "
            "and bilateral ankle swelling. He is unable to walk more than 10 steps "
            "without stopping. He gained 6 kg in the past week."
        ),
        "history": (
            "PMH: ischaemic heart failure (prior anterior MI 4 years ago), hypertension, "
            "AF on anticoagulation. "
            "Medications: furosemide 40 mg/day, sacubitril/valsartan 97/103 mg BD, "
            "bisoprolol 5 mg, spironolactone 25 mg, apixaban 5 mg BD, atorvastatin. "
            "Non-adherent to furosemide for past 10 days (ran out of prescription)."
        ),
        "physical_exam": (
            "BP 168/102, HR 92 (irregular — AF), RR 26, SpO2 88% on room air. "
            "JVP elevated 8 cm above sternal angle. "
            "Bilateral basal crackles to mid-zones. "
            "S3 gallop. Pansystolic murmur at apex (functional MR). "
            "Bilateral pitting oedema to mid-thigh. Hepatomegaly."
        ),
        "labs": (
            "BNP: 2,840 pg/mL. Troponin: 0.08 (mildly elevated — demand ischaemia). "
            "BMP: Na 132, K 3.2, Cr 1.6 (baseline 1.2). BUN 44. "
            "Hgb 11.4 g/dL. WBC normal. "
            "Albumin 32 g/L. LFTs: ALP 120, mild transaminitis (hepatic congestion)."
        ),
        "imaging": (
            "CXR: cardiomegaly, bilateral interstitial oedema, Kerley B lines, "
            "upper lobe diversion — severe pulmonary oedema. "
            "Echo (recent, 3 months ago): EF 32%, dilated LV, hypokinetic anterior wall, "
            "functional MR grade 2+."
        ),
        "discussion": (
            "Acute decompensated HF (ADHF) is the most common cause of emergency hospital "
            "admission in patients >65. The commonest precipitant is medication non-adherence "
            "(diuretics). Loop diuretics are the cornerstone of acute decongestion. "
            "BNP >400 pg/mL confirms a cardiac cause of dyspnoea. "
            "IV diuretics are more efficacious than oral in acute decompensation "
            "due to gut oedema impairing absorption."
        ),
        "diagnosis": "Acute decompensated HFrEF (EF 32%) precipitated by diuretic non-adherence; hypervolaemia with pulmonary oedema.",
        "management": (
            "Sit upright. O2 to target SpO2 >94% (CPAP/NIV if severe). "
            "IV furosemide 80–120 mg bolus (2–2.5× oral dose). "
            "Daily fluid balance; target 1–1.5 L negative/day. "
            "Daily weight, electrolytes, creatinine. "
            "K+ and Mg²⁺ replacement. "
            "Resume sacubitril/valsartan and spironolactone when diuresed and Cr stable. "
            "Discharge education: daily weights, low-salt diet, medication adherence plan."
        ),
        "chapter_ref": "p06_c257",
    },
    {
        "case_id": "case_030",
        "title": "NSTEMI in a 62-Year-Old with Diabetes",
        "specialty": "Cardiology",
        "presentation": (
            "A 62-year-old woman with type 2 diabetes and hypertension presents "
            "with 90 minutes of rest chest pain described as pressure-like, "
            "radiating to the jaw, associated with diaphoresis and nausea. "
            "Pain has partially improved but she remains uncomfortable."
        ),
        "history": (
            "PMH: T2DM (15 years), hypertension, dyslipidaemia, no prior MI. "
            "Medications: metformin, sitagliptin, ramipril, amlodipine, atorvastatin 40 mg. "
            "Social: ex-smoker (quit 3 years ago), 25 pack-years. "
            "Family history: father had MI at 55."
        ),
        "physical_exam": (
            "BP 164/96, HR 98, RR 18, SpO2 97%, T 36.9°C. "
            "Diaphoretic. No JVP elevation. "
            "Heart: regular rhythm, no murmurs. "
            "Lungs: clear. No peripheral oedema."
        ),
        "labs": (
            "Troponin I: 1.8 ng/mL at 0 h, 6.4 ng/mL at 3 h (rising — dynamic change). "
            "Glucose: 14.2 mmol/L. HbA1c: 9.8%. "
            "BMP: K+ 4.0, Cr 1.1. "
            "CBC: Hgb 12.8, WBC 10,200. "
            "Lipids: LDL 3.4 mmol/L. CRP: 22 mg/L."
        ),
        "imaging": (
            "ECG at presentation: ST depression 1.5–2 mm in V4–V6, T-wave inversion in I, aVL "
            "— no ST elevation. "
            "Repeat ECG 30 min: no evolution to STE. "
            "Coronary angiography (next day): 95% stenosis of mid-LAD, 70% of RCA — "
            "multivessel disease. PCI to LAD with drug-eluting stent."
        ),
        "discussion": (
            "NSTEMI is defined by rising troponin without persistent ST elevation. "
            "Dynamic ECG changes (ST depression, T-wave inversion) support ischaemia. "
            "GRACE risk score determines urgency of invasive strategy: >140 = high risk, "
            "requiring angiography <24 h. Diabetic patients have worse outcomes post-ACS "
            "due to impaired platelet responsiveness, multivessel disease, and delayed "
            "symptom recognition. Intensive lipid-lowering post-ACS reduces recurrence."
        ),
        "diagnosis": "Non-ST-elevation myocardial infarction (NSTEMI) with multivessel coronary artery disease.",
        "management": (
            "Dual antiplatelet: aspirin 300 mg loading, ticagrelor 180 mg loading (preferred "
            "in NSTEMI). Anticoagulation: fondaparinux 2.5 mg/day SC. "
            "High-intensity statin: rosuvastatin 40 mg. "
            "Angiography within 24 h (high-risk GRACE). PCI to culprit LAD lesion. "
            "Staged RCA revascularisation at 4–6 weeks. "
            "Post-PCI: dual antiplatelet for 12 months, then aspirin lifelong. "
            "ACE inhibitor, beta-blocker. Cardiac rehabilitation. Tight glycaemic control."
        ),
        "chapter_ref": "p06_c274",
    },
    {
        "case_id": "case_031",
        "title": "Acute Pericarditis Following Upper Respiratory Tract Infection",
        "specialty": "Cardiology",
        "presentation": (
            "A 32-year-old man presents with 3 days of sharp central chest pain, "
            "worse on inspiration and lying flat, relieved by sitting forward. "
            "He had a viral URTI 10 days ago. He denies dyspnoea at rest."
        ),
        "history": (
            "PMH: nil significant. No prior cardiac history. No autoimmune disease. "
            "Non-smoker. Medications: ibuprofen (started by GP 2 days ago — partial relief). "
            "No travel history. No TB contact."
        ),
        "physical_exam": (
            "T 38.2°C, HR 104, BP 122/78, RR 16, SpO2 99%. "
            "Pericardial friction rub (three-phase: systolic, early and late diastolic) "
            "at left sternal edge, loudest sitting forward. "
            "JVP not elevated. No pulsus paradoxus. "
            "Lungs: clear. No peripheral oedema."
        ),
        "labs": (
            "CRP: 88 mg/L. ESR: 62 mm/h. Troponin I: 0.28 ng/mL (mildly elevated — "
            "myopericarditis). WBC 13,200 (lymphocytosis). "
            "ANA, ANCA, anti-dsDNA: negative. TSH: normal. "
            "HIV: negative. Mycoplasma IgM: negative."
        ),
        "imaging": (
            "ECG: widespread saddle-shaped ST elevation in I, II, V2–V6; PR depression "
            "in II; reciprocal PR elevation in aVR — classic pericarditis pattern. "
            "Echo: small-moderate pericardial effusion (1.2 cm). Normal LV function. "
            "No RV collapse (no tamponade). "
            "CXR: mild cardiomegaly from effusion."
        ),
        "discussion": (
            "Acute pericarditis is most commonly viral/idiopathic in developed countries. "
            "Diagnosis requires ≥2 of 4 criteria: pericarditic chest pain, friction rub, "
            "ECG changes (diffuse ST elevation with PR depression), new/worsening effusion. "
            "Elevated troponin indicates myopericarditis — these patients require "
            "activity restriction for 3–6 months. Risk factors for recurrence (>30%): "
            "fever >38°C, subacute onset, large effusion, troponin elevation."
        ),
        "diagnosis": "Acute viral pericarditis with myopericarditis (elevated troponin, pericardial effusion).",
        "management": (
            "NSAIDs: ibuprofen 600 mg TDS × 2 weeks then taper (preferred unless contraindicated). "
            "Colchicine 500 µg BD × 3 months (reduces recurrence by 50% — COPE/ICAP trial). "
            "Restrict strenuous exercise for 3 months (myopericarditis). "
            "Avoid NSAIDs if significant effusion. "
            "No steroids first-line (risk of recurrence increased). "
            "Follow-up echo at 4–6 weeks. Cardiology review for recurrent disease "
            "(consider IL-1 blockade: anakinra)."
        ),
        "chapter_ref": "p06_c270",
    },
    # ── Additional Pulmonology ────────────────────────────────────────────────
    {
        "case_id": "case_032",
        "title": "Near-Fatal Asthma Attack in a Young Woman",
        "specialty": "Pulmonology",
        "presentation": (
            "A 24-year-old woman with known severe asthma is brought by ambulance "
            "following a 4-hour deterioration in breathing that did not respond to "
            "10 puffs of salbutamol. She cannot speak in sentences."
        ),
        "history": (
            "PMH: severe persistent asthma since age 8, two prior ITU admissions. "
            "Medications: high-dose ICS/LABA (fluticasone/salmeterol 500/50 BD), "
            "montelukast, prednisolone 5 mg/day (oral steroid-dependent). "
            "Known triggers: cat dander, NSAIDs, cold air. "
            "Non-smoker. Visited her friend's cat-owning house 6 hours ago."
        ),
        "physical_exam": (
            "Agitated, cannot complete sentences. T 37.3°C, HR 138, BP 118/78, RR 34, "
            "SpO2 84% on 15 L non-rebreather. Pulsus paradoxus 18 mmHg. "
            "Accessory muscle use (sternomastoids contracting). "
            "Chest: hyperresonant, markedly reduced air entry bilaterally, "
            "high-pitched expiratory wheeze. Silent chest developing. "
            "Peak flow (managed): 95 L/min (predicted 480 L/min — 20%)."
        ),
        "labs": (
            "ABG (15 L O2): pH 7.28, PaO2 58 mmHg, PaCO2 52 mmHg, HCO3 22 — "
            "mixed: type 2 respiratory failure + compensated metabolic (CO2 rising — critical sign). "
            "K+ 3.0 (salbutamol-driven hypokalaemia). Glucose 10.4. "
            "WBC 14,200 (steroid demargination). CRP 24 mg/L. Theophylline level: subtherapeutic."
        ),
        "imaging": (
            "CXR (portable): hyperinflation, flattened diaphragms, no pneumothorax, "
            "no pneumomediastinum, no consolidation. "
            "ECG: sinus tachycardia, right axis deviation, P pulmonale."
        ),
        "discussion": (
            "Life-threatening asthma features: SpO2 <92%, PEF <33% predicted, "
            "silent chest, cyanosis, exhaustion. Near-fatal asthma: rising PaCO2 (normo- or "
            "hypercapnia in an acute attack means impending respiratory arrest — the expected "
            "response is hypocapnia from hyperventilation). Intubation in asthma is high risk "
            "(dynamic hyperinflation, auto-PEEP); NIV is not effective for severe asthma. "
            "Magnesium IV has bronchodilator properties via calcium channel inhibition."
        ),
        "diagnosis": "Near-fatal acute severe asthma with type 2 respiratory failure and rising PaCO2.",
        "management": (
            "Immediate: continuous nebulised salbutamol 5 mg + ipratropium 500 µg. "
            "O2 to maintain SpO2 94–98%. "
            "IV magnesium sulphate 2 g over 20 min (single dose). "
            "IV hydrocortisone 200 mg stat then 100 mg QID. "
            "IV/oral prednisolone 40–50 mg/day. "
            "K+ replacement. "
            "Anaesthetics review — intubation if GCS dropping, silent chest, exhaustion. "
            "ICU admission. Post-crisis: step up ICS/LABA; consider omalizumab or mepolizumab "
            "for severe allergic/eosinophilic asthma."
        ),
        "chapter_ref": "p07_c287",
    },
    {
        "case_id": "case_033",
        "title": "Legionella Pneumonia in an Immunocompromised Patient",
        "specialty": "Pulmonology",
        "presentation": (
            "A 58-year-old man who returned from a hotel stay in Spain 7 days ago "
            "presents with 5 days of high fevers, dry cough, confusion, and diarrhoea. "
            "He appears very unwell and requires supplemental oxygen."
        ),
        "history": (
            "PMH: renal transplant 3 years ago (tacrolimus, mycophenolate, prednisolone 5 mg). "
            "Hypertension, CKD baseline Cr 1.6. "
            "No prior respiratory infections. Stayed in hotel with communal whirlpool spa."
        ),
        "physical_exam": (
            "T 39.4°C, HR 118, BP 96/62, RR 28, SpO2 88% on 6 L O2. GCS 13. "
            "Dehydrated. Bilateral basal crackles, right > left. "
            "Confusion (disoriented to time). "
            "No meningism. No rash. No lymphadenopathy."
        ),
        "labs": (
            "WBC 4,200/µL (lymphopenia 800 — immunosuppressed). CRP 320 mg/L. "
            "Na: 126 mmol/L (hyponatraemia — classic Legionella feature). "
            "Creatinine: 2.8 (acute on CKD). LFTs: ALT 88, ALP 210 (elevated). "
            "LDH: 580 U/L. Phosphate: 0.6 mmol/L (hypophosphataemia). "
            "ABG: PaO2 52 mmHg (type 1 respiratory failure). "
            "Legionella urinary antigen: positive (detects serogroup 1)."
        ),
        "imaging": (
            "CXR: bilateral lower lobe consolidation, right more than left. "
            "CT chest: multilobar consolidation, small bilateral pleural effusions. "
            "No cavitation."
        ),
        "discussion": (
            "Legionella pneumophila (serogroup 1) accounts for 80–90% of Legionnaires' disease. "
            "Classic clinical clues: high fever, GI symptoms (diarrhoea), confusion, "
            "hyponatraemia, elevated LFTs, and lymphopenia. Urinary antigen is positive in "
            "80–90% within 24 h. Immunocompromised patients (transplant, steroids) are at "
            "highest risk and have higher mortality. Legionella is an intracellular pathogen "
            "— beta-lactams are ineffective; macrolides/quinolones penetrate cells."
        ),
        "diagnosis": "Severe Legionella pneumophila pneumonia (Legionnaires' disease) in a renal transplant recipient.",
        "management": (
            "IV levofloxacin 750 mg/day (fluoroquinolone — first-line for severe Legionella). "
            "OR azithromycin 500 mg/day (alternative). "
            "Duration: 5–10 days (immunocompetent), 14–21 days (immunosuppressed). "
            "IV fluid resuscitation. "
            "Reduce immunosuppression temporarily (reduce mycophenolate, maintain tacrolimus). "
            "ICU if deteriorating. "
            "Report to public health (notifiable disease). "
            "Source investigation (hotel spa water sampling). "
            "Renal function monitoring daily."
        ),
        "chapter_ref": "p05_c126",
    },
    # ── Additional Neurology ─────────────────────────────────────────────────
    {
        "case_id": "case_034",
        "title": "Acute Ischaemic Stroke: Left MCA Territory",
        "specialty": "Neurology",
        "presentation": (
            "A 72-year-old right-handed man develops sudden-onset right-sided face and arm "
            "weakness, expressive dysphasia, and right homonymous hemianopia. "
            "His wife witnessed the onset at 08:15; he arrives in the ED at 09:05."
        ),
        "history": (
            "PMH: hypertension, paroxysmal AF (on aspirin only — not anticoagulated), "
            "T2DM, hyperlipidaemia. "
            "Medications: amlodipine 10 mg, aspirin 75 mg, metformin, atorvastatin 20 mg. "
            "Social: 30 pack-year smoking, quit 5 years ago. "
            "No prior stroke or TIA."
        ),
        "physical_exam": (
            "BP 196/108, HR 102 (irregular), RR 16, SpO2 97%, T 37.0°C. GCS 13 (E4V3M6). "
            "Right facial droop (UMN pattern). "
            "Right arm power 0/5; right leg 3/5. "
            "Non-fluent aphasia (Broca's area). "
            "Right homonymous hemianopia (confrontational testing). "
            "NIHSS score: 18 (severe)."
        ),
        "labs": (
            "Glucose 7.8 mmol/L. CBC: Hgb 13.4, platelets 188,000. "
            "INR 1.1 (not anticoagulated). APTT normal. "
            "BMP: Na 140, K+ 3.8, Cr 1.0. LFTs: normal. "
            "HbA1c: 8.2%. Lipids: LDL 3.2 mmol/L. "
            "Troponin: normal. ECG: AF (irregularly irregular)."
        ),
        "imaging": (
            "CT head (non-contrast): no haemorrhage, hyperdense left MCA sign. "
            "ASPECTS score 8 (good candidate for thrombolysis/thrombectomy). "
            "CT angiography: left internal carotid/MCA M1 occlusion. "
            "CT perfusion: large penumbra (ischaemic but salvageable tissue)."
        ),
        "discussion": (
            "Ischaemic stroke from cardioembolic AF (inadequate anticoagulation) is the most "
            "common stroke aetiology in elderly patients with AF. Time-sensitive treatment "
            "windows: IV thrombolysis (tPA) ≤4.5 h from onset; mechanical thrombectomy (MT) "
            "≤24 h for large vessel occlusion with significant penumbra. "
            "NIHSS ≥6 with LVO on CTA should trigger immediate stroke team activation for MT. "
            "Anticoagulation for secondary prevention in AF must be started 'early' "
            "(usually 3–14 days post-stroke depending on size)."
        ),
        "diagnosis": "Acute large vessel ischaemic stroke (left ICA/MCA occlusion) secondary to cardioembolism from AF.",
        "management": (
            "Activate stroke thrombectomy pathway immediately. "
            "IV alteplase 0.9 mg/kg (max 90 mg) — if no contraindications (door-to-needle <60 min). "
            "Mechanical thrombectomy (MT) with stent retriever (first-line for LVO — DAWN/DEFUSE-3). "
            "Permissive hypertension (do not treat BP <220/120 pre-thrombolysis). "
            "Antiepileptic if seizure. Aspirin 300 mg (24 h post-tPA). "
            "Anticoagulate with DOAC at day 3–14 (small stroke) or later (large stroke). "
            "Decompressive craniectomy if malignant MCA syndrome. "
            "Stroke unit admission; swallowing assessment; physiotherapy."
        ),
        "chapter_ref": "p13_c427",
    },
    {
        "case_id": "case_035",
        "title": "Generalised Tonic-Clonic Status Epilepticus",
        "specialty": "Neurology",
        "presentation": (
            "A 19-year-old man is brought by ambulance with continuous seizure activity. "
            "Bystanders report the seizure began 28 minutes ago with no preceding aura. "
            "He is unresponsive with ongoing tonic-clonic limb movements."
        ),
        "history": (
            "PMH: epilepsy (juvenile myoclonic epilepsy) since age 14. "
            "Medications: sodium valproate 1,000 mg BD (reported by mother — took last dose "
            "36 hours ago, had run out). No alcohol or recreational drugs. "
            "No recent illness or fever. Non-smoker."
        ),
        "physical_exam": (
            "GCS 3 (E1V1M1). Ongoing tonic-clonic movements. "
            "T 38.8°C (post-ictal pyrexia ± aspiration risk). HR 142, BP 168/104, SpO2 88%. "
            "Tongue laceration. Cyanotic lips. "
            "Urinary incontinence. "
            "No focal neurological deficit visible during seizure."
        ),
        "labs": (
            "Glucose (bedside): 4.2 mmol/L (exclude hypoglycaemia). "
            "Valproate level: 18 µg/mL (sub-therapeutic; therapeutic 50–100). "
            "Na: 138. K: 4.1. Ca²⁺: 2.34. "
            "ABG: pH 7.22, PaCO2 46, PaO2 54, lactate 8.1 (lactic acidosis from convulsions). "
            "CBC: WBC 14,800 (stress response). CRP: 12 mg/L. "
            "Urine drug screen: negative. Alcohol: 0."
        ),
        "imaging": (
            "CT head (after seizures controlled): no haemorrhage, no structural lesion. "
            "MRI brain (post-stabilisation): bilateral hippocampal T2 signal changes "
            "(postictal change, no herpes encephalitis pattern). "
            "EEG (after termination): generalised slowing, no ongoing subclinical SE."
        ),
        "discussion": (
            "Status epilepticus (SE) is defined as a seizure lasting ≥5 minutes or ≥2 seizures "
            "without return to baseline. Treatment is time-critical: each 10-minute delay "
            "increases refractory SE risk. Benzodiazepines are first-line (IV lorazepam > IM "
            "midazolam > rectal diazepam). If no IV access, IM midazolam is non-inferior. "
            "After two failed benzodiazepine doses: second-line agent (levetiracetam, "
            "valproate, or phenytoin IV). Sub-therapeutic anticonvulsant level is the most "
            "common cause of breakthrough SE."
        ),
        "diagnosis": "Generalised tonic-clonic status epilepticus secondary to valproate non-compliance in juvenile myoclonic epilepsy.",
        "management": (
            "Airway: recovery position, jaw thrust, high-flow O2. IV access. "
            "Lorazepam 0.1 mg/kg IV (max 4 mg) — repeat once at 5 min if no response. "
            "If IV not available: IM midazolam 10 mg. "
            "If still seizing at 10 min (established SE): "
            "IV levetiracetam 60 mg/kg (max 4.5 g over 15 min) OR IV valproate 40 mg/kg. "
            "Refractory SE: anaesthetic agents (thiopental, propofol) in ICU with EEG. "
            "Post-SE: reload valproate, investigate cause, restart regular medication. "
            "Driving restriction: seizure-free for ≥12 months before driving."
        ),
        "chapter_ref": "p13_c425",
    },
    # ── Additional Endocrinology ─────────────────────────────────────────────
    {
        "case_id": "case_036",
        "title": "Thyroid Storm Precipitated by Emergency Surgery",
        "specialty": "Endocrinology",
        "presentation": (
            "A 38-year-old woman with known but poorly controlled Graves' disease "
            "develops agitation, high fever, and palpitations 12 hours after an "
            "emergency laparoscopic appendicectomy. The ICU is called to review her."
        ),
        "history": (
            "PMH: Graves' disease (diagnosed 8 months ago). "
            "Medications: carbimazole 10 mg/day (poor compliance). "
            "No prior radioiodine or thyroidectomy. "
            "Stopped carbimazole 2 weeks pre-op on anaesthetist advice (unfounded). "
            "Social: non-smoker, works as a nurse."
        ),
        "physical_exam": (
            "T 40.6°C, HR 162 (irregular — AF), BP 146/58 (wide pulse pressure), "
            "RR 28, SpO2 96%. Agitated, confused (GCS 13). "
            "Profuse diaphoresis. "
            "Diffuse goitre with thyroid bruit. Exophthalmos. "
            "Fine tremor of outstretched hands. "
            "Liver: 2 cm below costal margin (congestive)."
        ),
        "labs": (
            "TSH: <0.01 mIU/L (undetectable). Free T4: 78 pmol/L (>3× ULN). "
            "Free T3: 22 pmol/L (markedly elevated). "
            "Glucose: 14.8 mmol/L. Calcium: 2.72 mmol/L (hypercalcaemia — thyroid bone resorption). "
            "LFTs: ALT 88, ALP 220 (elevated). WBC 18,000 (stress response). "
            "Blood cultures: pending (fever evaluation)."
        ),
        "imaging": (
            "CXR: mild cardiomegaly, no pulmonary oedema. "
            "ECG: AF at 160 bpm, no ST changes. "
            "Thyroid ultrasound (prior): diffusely enlarged, hypervascularity (Graves')."
        ),
        "discussion": (
            "Thyroid storm (Burch-Wartofsky score ≥45) is a life-threatening endocrine emergency "
            "with mortality 8–25%. Precipitants include surgery, infection, radioiodine, "
            "and iodine contrast. The pathophysiology involves sudden excess thyroid hormone "
            "with heightened catecholamine sensitivity. Treatment requires: (1) blocking "
            "hormone synthesis (thionamide), (2) blocking hormone release (iodine — after "
            "thionamide to prevent iodine-induced synthesis), (3) blocking peripheral conversion "
            "and sympathetic effects (beta-blocker, glucocorticoids)."
        ),
        "diagnosis": "Thyroid storm (Burch-Wartofsky score 65) precipitated by surgery in uncontrolled Graves' disease.",
        "management": (
            "ICU admission. Continuous cardiac monitoring. "
            "1. Propylthiouracil (PTU) 500–1,000 mg loading, then 250 mg q4h (blocks synthesis AND "
            "peripheral T4→T3 conversion). "
            "2. Lugol's iodine 8 drops q6h — start 1 hour AFTER PTU. "
            "3. IV propranolol 1 mg q5 min (titrate to HR <100); oral propranolol 60–80 mg q4h. "
            "4. Hydrocortisone 300 mg IV stat, then 100 mg q8h (blocks peripheral conversion). "
            "5. Paracetamol for fever (NO aspirin — displaces thyroid hormone from TBG). "
            "Treat precipitating infection. Cooling blankets. "
            "Definitive therapy: thyroidectomy after stabilisation."
        ),
        "chapter_ref": "p12_c384",
    },
    {
        "case_id": "case_037",
        "title": "Adrenal Crisis in a Patient on Long-Term Steroids",
        "specialty": "Endocrinology",
        "presentation": (
            "A 47-year-old man with rheumatoid arthritis is brought to the ED in a "
            "collapsed state. He has been vomiting for 2 days with an acute gastroenteritis "
            "and was unable to take his usual morning prednisolone."
        ),
        "history": (
            "PMH: RA (on prednisolone 10 mg/day for 4 years), GORD. "
            "Medications: prednisolone 10 mg/day, methotrexate 15 mg/week, omeprazole. "
            "No prior adrenal crisis. He was not advised about sick-day rules. "
            "No recent travel. Gastroenteritis in household × 3 days."
        ),
        "physical_exam": (
            "BP 74/44 (supine), HR 136, T 37.4°C, RR 22, SpO2 97%. GCS 13. "
            "Profound weakness and malaise. "
            "Hyperpigmentation of buccal mucosa and palmar creases (chronic adrenal insufficiency). "
            "Dry mucous membranes. "
            "Abdomen: mild diffuse tenderness. No guarding."
        ),
        "labs": (
            "Na: 128 mmol/L (hyponatraemia). K+: 5.8 mmol/L (hyperkalaemia). "
            "Glucose: 2.8 mmol/L (hypoglycaemia). "
            "Creatinine: 1.9 (pre-renal AKI). BUN 44. "
            "Cortisol (random): 88 nmol/L (inappropriately low, <550 nmol/L in crisis). "
            "ACTH: 192 pmol/L (elevated — primary adrenal insufficiency). "
            "CBC: eosinophilia (classic in Addison's)."
        ),
        "imaging": (
            "CT abdomen: no adrenal masses. Bilateral adrenal glands appear small "
            "(consistent with autoimmune adrenal insufficiency). "
            "CXR: clear. ECG: peaked T waves (hyperkalaemia)."
        ),
        "discussion": (
            "Adrenal crisis is a medical emergency arising from acute relative or absolute "
            "cortisol deficiency, most commonly triggered by intercurrent illness in a patient "
            "on chronic glucocorticoids (HPA axis suppression) or with primary adrenal "
            "insufficiency (Addison's disease). The classic biochemical triad: hyponatraemia, "
            "hyperkalaemia, hypoglycaemia. Do NOT delay hydrocortisone for confirmatory "
            "tests — treat empirically if clinical suspicion is high. "
            "Failure to double/triple glucocorticoid dose during illness is the primary "
            "preventable cause."
        ),
        "diagnosis": "Acute adrenal crisis secondary to glucocorticoid-induced HPA axis suppression; underlying primary adrenal insufficiency.",
        "management": (
            "Immediate: IV access × 2. "
            "Hydrocortisone 100 mg IV stat (DO NOT DELAY) — then 50–100 mg q6–8h or "
            "200 mg/24h continuous infusion. "
            "IV 0.9% saline 1 L over 30–60 min (for hypotension + hyponatraemia). "
            "Dextrose 50 mL of 50% (for hypoglycaemia) then continuous D5-saline. "
            "Treat precipitating infection if present. "
            "Do NOT give fludrocortisone acutely (mineralocorticoid) — high-dose "
            "hydrocortisone provides sufficient mineralocorticoid effect. "
            "After crisis: restart prednisolone with sick-day rule education; "
            "MedicAlert bracelet; IM hydrocortisone home kit (100 mg ampoule)."
        ),
        "chapter_ref": "p12_c386",
    },
    # ── Additional Gastroenterology ──────────────────────────────────────────
    {
        "case_id": "case_038",
        "title": "Severe Acute Pancreatitis with Necrosis",
        "specialty": "Gastroenterology",
        "presentation": (
            "A 45-year-old man presents with a 12-hour history of severe epigastric "
            "pain radiating to the back, associated with nausea, vomiting, and an "
            "inability to eat or drink. He consumed a large amount of alcohol the "
            "night before onset."
        ),
        "history": (
            "PMH: two prior mild episodes of pancreatitis (alcohol-related). "
            "Alcohol use: 80–100 g/day (heavy user). No gallstone disease. "
            "No medications that cause pancreatitis. Non-smoker. "
            "Social: works as a builder, lives alone."
        ),
        "physical_exam": (
            "T 38.6°C, HR 122, BP 96/60, RR 22, SpO2 94% on room air. "
            "Jaundiced (mild). Abdomen: severe epigastric and left upper quadrant tenderness, "
            "guarding. Reduced bowel sounds. "
            "Grey Turner sign (flank ecchymosis). Cullen sign (periumbilical ecchymosis). "
            "No ascites."
        ),
        "labs": (
            "Amylase: 2,840 U/L (>3× ULN). Lipase: 4,200 U/L (>3× ULN). "
            "WBC: 22,000/µL. CRP: 280 mg/L (at 48 h — marks severity). "
            "LFTs: ALT 88, ALP 240, bilirubin 52 µmol/L. "
            "Calcium: 1.88 mmol/L (hypocalcaemia — saponification). "
            "Creatinine: 2.2 mg/dL (AKI). Glucose: 18.4 mmol/L. "
            "Hct: 52% (haemoconcentration — poor prognostic sign). "
            "ABG: PaO2 62 mmHg (early ARDS). "
            "BISAP score: 4 (high mortality risk)."
        ),
        "imaging": (
            "CT abdomen/pelvis with IV contrast (at 72 h): "
            "Pancreatic necrosis involving >50% of gland (CTSI severity index 9/10). "
            "Peripancreatic fluid collections. "
            "Bilateral pleural effusions. No free air. "
            "ERCP not indicated (no biliary obstruction/ascending cholangitis)."
        ),
        "discussion": (
            "Severe acute pancreatitis (modified Atlanta classification: persistent organ "
            "failure >48 h) has mortality of 20–40% when complicated by infected necrosis. "
            "Grey-Turner and Cullen signs indicate retroperitoneal haemorrhage (haemorrhagic "
            "pancreatitis). CTSI ≥7 predicts high morbidity. "
            "CT should be delayed 48–72 h post-onset for accurate necrosis assessment. "
            "Infected necrosis (fever, rising CRP after initial improvement) requires "
            "CT-guided aspiration for culture then endoscopic or surgical necrosectomy."
        ),
        "diagnosis": "Severe alcohol-induced acute pancreatitis with pancreatic necrosis (>50%) and ARDS (CTSI 9/10).",
        "management": (
            "ICU admission. Aggressive IV fluid resuscitation: lactated Ringer's preferred "
            "(250 mL/h for 48 h, then guided by lactate and UO). "
            "Early enteral nutrition (nasojejunal tube within 24–48 h — NOT parenteral). "
            "Analgesia: IV opioids (PCA morphine). "
            "No prophylactic antibiotics (no survival benefit). "
            "Insulin infusion for glucose >10 mmol/L. "
            "Ca²⁺ and Mg²⁺ replacement. "
            "Infected necrosis: meropenem + step-up approach (CT-guided drainage → endoscopic "
            "necrosectomy → surgical last resort). "
            "Alcohol cessation counselling (key to preventing recurrence)."
        ),
        "chapter_ref": "p10_c348",
    },
    {
        "case_id": "case_039",
        "title": "Acute Hepatitis B with Risk of Fulminant Hepatic Failure",
        "specialty": "Gastroenterology",
        "presentation": (
            "A 26-year-old man presents with a 2-week history of fatigue, anorexia, "
            "right upper quadrant discomfort, and jaundice that has worsened over the "
            "last 3 days. He is an IV drug user who shares needles."
        ),
        "history": (
            "PMH: nil. No prior hepatitis vaccination. No prior jaundice or liver disease. "
            "Social: IV heroin use for 3 years, shares equipment. "
            "Alcohol: 20 units/week. Sexual history: multiple partners, inconsistent condom use. "
            "No medications. No herbal remedies. No travel."
        ),
        "physical_exam": (
            "BP 110/72, HR 94, T 37.8°C. Jaundiced (icteric sclerae, yellow skin). "
            "RUQ tenderness with tender hepatomegaly (3 cm below costal margin). "
            "No splenomegaly. No stigmata of chronic liver disease. "
            "No ascites. No encephalopathy. No asterixis."
        ),
        "labs": (
            "ALT: 2,840 U/L. AST: 1,960 U/L. ALP: 280 U/L. "
            "Bilirubin: 148 µmol/L (predominantly conjugated). "
            "INR: 1.8 (early coagulopathy — monitor closely). "
            "Albumin: 32 g/L. "
            "HBsAg: positive. Anti-HBs: negative. IgM anti-HBc: positive (confirms acute infection). "
            "HBeAg: positive. HBV DNA: 2.4 × 10⁸ IU/mL. "
            "Anti-HCV: negative. HIV: negative. Anti-HAV IgM: negative."
        ),
        "imaging": (
            "Ultrasound liver: enlarged liver with diffusely reduced echogenicity (hepatitis "
            "pattern). No focal lesions. No biliary dilatation. Patent portal vein."
        ),
        "discussion": (
            "Acute hepatitis B resolves spontaneously in 95% of immunocompetent adults, "
            "but 1% progress to fulminant hepatic failure (FHF) — mortality >80% without "
            "transplant. FHF risk indicators: INR >1.5 (coagulopathy), bilirubin rising "
            "despite improving transaminases, encephalopathy, hepatic size decrease on US. "
            "IgM anti-HBc distinguishes acute from chronic HBV (which has IgG anti-HBc). "
            "Antiviral therapy (tenofovir) is not standard for acute HBV in "
            "immunocompetent patients unless FHF or severe/prolonged course."
        ),
        "diagnosis": "Acute hepatitis B (IgM anti-HBc positive, HBV DNA 2.4 × 10⁸ IU/mL) with early coagulopathy.",
        "management": (
            "Hospitalise for monitoring. Avoid hepatotoxic drugs and alcohol. "
            "Serial INR, bilirubin, creatinine (q24–48h) to detect FHF early. "
            "No dietary restriction needed. "
            "If FHF develops (INR >1.5 + encephalopathy): refer for urgent liver transplant "
            "evaluation; start tenofovir alafenamide (TAF) 25 mg/day. "
            "Supportive: antiemetics, IV fluids, lactulose if encephalopathy. "
            "N-acetylcysteine infusion if severe acute hepatitis (emerging evidence). "
            "Harm reduction: needle exchange, opioid substitution, HBV vaccination of contacts. "
            "Notify public health. Household contacts: HBV vaccination + HBIG if unvaccinated."
        ),
        "chapter_ref": "p10_c339",
    },
    # ── Additional Infectious Disease ────────────────────────────────────────
    {
        "case_id": "case_040",
        "title": "Pulmonary Tuberculosis in a Recent Immigrant",
        "specialty": "Infectious Disease",
        "presentation": (
            "A 34-year-old man from Somalia, living in the UK for 8 months, presents "
            "with a 3-month history of productive cough, haemoptysis, evening fevers, "
            "drenching night sweats, and 12 kg weight loss."
        ),
        "history": (
            "PMH: nil known. No prior TB treatment. HIV status unknown. "
            "Social: lives in an overcrowded shared house with 8 others; two housemates "
            "have a similar cough. No alcohol or drug use. "
            "No known TB contact officially reported. Came from a high-TB-burden country."
        ),
        "physical_exam": (
            "BMI 17.2 (underweight). T 38.1°C, HR 98, RR 20, SpO2 96%, BP 112/72. "
            "Dull to percussion in right upper zone. "
            "Amphoric breathing and coarse crackles in right apex. "
            "No lymphadenopathy. No hepatosplenomegaly. "
            "Skin: no erythema nodosum. No oral ulcers."
        ),
        "labs": (
            "Hgb 10.2 g/dL (normocytic). WBC: 6,800 (mild lymphocytosis). "
            "CRP: 82 mg/L. ESR: 88 mm/h. Na: 128 mmol/L (SIADH — TB). "
            "HIV 4th-generation antigen/antibody: negative. "
            "Sputum AFB smear: 3+ (highly infectious). "
            "Sputum NAAT (GeneXpert MTB/RIF): M. tuberculosis detected, rifampicin-sensitive. "
            "LFTs: ALT 44 (mildly elevated — monitor on anti-TB drugs)."
        ),
        "imaging": (
            "CXR: right upper lobe consolidation with cavitation (4.5 cm cavity). "
            "Fibrosis and volume loss in right upper lobe. "
            "CT chest: cavitating lesion with surrounding satellite nodules "
            "(tree-in-bud pattern — active endobronchial spread). "
            "No pleural effusion. No mediastinal lymphadenopathy."
        ),
        "discussion": (
            "Pulmonary TB due to Mycobacterium tuberculosis is the world's most deadly "
            "infectious disease. Upper lobe cavitation with AFB-positive sputum represents "
            "highly infectious post-primary (reactivation) disease. NAAT (GeneXpert) is "
            "WHO-recommended first-line test: sensitivity 88%, specificity 99%, with "
            "simultaneous rifampicin resistance detection. SIADH (hyponatraemia) occurs "
            "in 5–10% of active TB. Household contacts must be screened for LTBI and active TB."
        ),
        "diagnosis": "Smear-positive pulmonary tuberculosis (AFB 3+, GeneXpert positive, rifampicin-sensitive), WHO category I.",
        "management": (
            "Respiratory isolation until 2 weeks on treatment + clinical improvement + "
            "two negative sputum smears. "
            "Standard DOTS (directly observed therapy): "
            "Intensive phase (2 months): HRZE — isoniazid + rifampicin + pyrazinamide + ethambutol. "
            "Continuation phase (4 months): HR — isoniazid + rifampicin. "
            "Pyridoxine (vitamin B6) 10–25 mg/day (prevent INH neuropathy). "
            "Monitor LFTs monthly (drug hepatotoxicity — stop if ALT >5× ULN). "
            "Contact tracing: all household contacts for TB testing. "
            "Notify public health authority (statutory notifiable disease). "
            "HIV testing (if results were negative, recheck at 6 weeks). "
            "Follow-up sputum at 2 and 5 months to confirm cure."
        ),
        "chapter_ref": "p05_c178",
    },
]


def seed(collection: Collection) -> None:  # type: ignore[type-arg]
    inserted = 0
    skipped = 0

    for case in CASES:
        if collection.find_one({"case_id": case["case_id"]}):
            skipped += 1
        else:
            collection.insert_one(dict(case))
            inserted += 1

    total = len(CASES)
    print(
        f"Seed complete — {total} cases in dataset: "
        f"{inserted} inserted, {skipped} already present."
    )


def main() -> None:
    client: MongoClient = MongoClient(MONGO_URI)  # type: ignore[type-arg]
    try:
        db_name = MongoClient(MONGO_URI).get_default_database().name  # type: ignore[union-attr]
        db = client.get_database(db_name)
    except Exception:
        db_name = MONGO_URI.rsplit("/", 1)[-1].split("?")[0] or "CoreMD"
        db = client.get_database(db_name)

    collection = db.get_collection("cases")
    collection.create_index("case_id", unique=True, background=True)

    seed(collection)
    client.close()


if __name__ == "__main__":
    main()
