"""
seed_case_questions.py — Seed 2 step-questions for each of the first 5 cases.

Idempotent: questions already present (keyed on case_question_id) are skipped.
A unique index on case_question_id is created automatically.

Usage (from project root):
    python backend/scripts/seed_case_questions.py
"""

import os
import sys
from pathlib import Path
from typing import Any

from pymongo import MongoClient, ASCENDING
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
# Questions keyed by case_id.
# Q1 (step=1): initial diagnosis / most likely finding
# Q2 (step=2): management / next best step
# case_question_id format: cq_{case_id}_s{step}
# ---------------------------------------------------------------------------

CASE_QUESTIONS: list[dict[str, Any]] = [
    # ── case_cardiology_001 — Inferior STEMI ────────────────────────────────
    {
        "case_question_id": "cq_case_cardiology_001_s1",
        "case_id": "case_cardiology_001",
        "step": 1,
        "stem": (
            "A 58-year-old diabetic man presents with 2 hours of crushing substernal "
            "chest pain radiating to the left arm, diaphoresis, and nausea. ECG shows "
            "ST elevations in leads II, III, and aVF with reciprocal changes in I and "
            "aVL. Troponin I is 4.2 ng/mL. What is the most likely diagnosis?"
        ),
        "options": [
            "Non-ST-elevation myocardial infarction (NSTEMI)",
            "Inferior ST-elevation myocardial infarction (STEMI) due to RCA occlusion",
            "Anterior STEMI due to LAD occlusion",
            "Unstable angina with demand ischaemia",
        ],
        "correct_option": 1,
        "explanation": (
            "ST elevations in the inferior leads (II, III, aVF) with reciprocal "
            "depression in I and aVL are the hallmark of inferior STEMI, which is most "
            "commonly caused by acute occlusion of the right coronary artery (RCA). The "
            "significantly elevated troponin confirms myocardial necrosis, distinguishing "
            "this from unstable angina. Anterior STEMI would show ST elevation in V1–V4. "
            "NSTEMI does not produce ST elevations."
        ),
    },
    {
        "case_question_id": "cq_case_cardiology_001_s2",
        "case_id": "case_cardiology_001",
        "step": 2,
        "stem": (
            "The cath lab is available. The patient is haemodynamically stable (BP 155/95, "
            "HR 102). Which of the following is the most appropriate immediate management?"
        ),
        "options": [
            "IV thrombolysis with alteplase and admit to CCU",
            "Aspirin 325 mg + ticagrelor, IV heparin, and activate cath lab for primary PCI within 90 minutes",
            "Aspirin 325 mg, high-dose statin, and urgent stress echocardiogram",
            "IV metoprolol alone to reduce myocardial oxygen demand",
        ],
        "correct_option": 1,
        "explanation": (
            "Primary percutaneous coronary intervention (PCI) within 90 minutes of first "
            "medical contact is the standard of care for STEMI when a cath lab is available. "
            "Dual antiplatelet therapy (aspirin + P2Y12 inhibitor such as ticagrelor) and "
            "IV unfractionated heparin are given before the procedure. Thrombolysis is "
            "reserved for centres without timely PCI capability. A stress echocardiogram "
            "is inappropriate in the acute STEMI setting. Beta-blockers may be added for "
            "haemodynamically stable patients but do not replace reperfusion."
        ),
    },
    # ── case_cardiology_002 — New-Onset AF with RVR ─────────────────────────
    {
        "case_question_id": "cq_case_cardiology_002_s1",
        "case_id": "case_cardiology_002",
        "step": 1,
        "stem": (
            "A 67-year-old woman with hypertension presents with 8 hours of palpitations "
            "and mild dyspnoea. HR is 142 bpm and irregular. ECG shows absent P waves and "
            "an irregularly irregular narrow-complex tachycardia. TSH and troponin are "
            "normal. What is the most likely diagnosis?"
        ),
        "options": [
            "Atrial flutter with 2:1 conduction",
            "Multifocal atrial tachycardia",
            "New-onset atrial fibrillation with rapid ventricular response",
            "AV nodal re-entrant tachycardia (AVNRT)",
        ],
        "correct_option": 2,
        "explanation": (
            "The combination of absent P waves, irregularly irregular rhythm, and narrow "
            "complexes at 142 bpm is diagnostic of atrial fibrillation (AF). Atrial flutter "
            "typically produces a regular 'sawtooth' baseline at 300 bpm with regular "
            "conduction. Multifocal atrial tachycardia shows at least 3 distinct P-wave "
            "morphologies and is typically associated with pulmonary disease. AVNRT is "
            "regular. Normal TSH excludes thyrotoxicosis as a trigger."
        ),
    },
    {
        "case_question_id": "cq_case_cardiology_002_s2",
        "case_id": "case_cardiology_002",
        "step": 2,
        "stem": (
            "The patient's CHA₂DS₂-VASc score is 3 (age ≥65, female sex, hypertension). "
            "She is haemodynamically stable. AF duration is confirmed at 8 hours. Which "
            "is the most appropriate next management step?"
        ),
        "options": [
            "Immediate DC cardioversion without anticoagulation",
            "IV amiodarone infusion for rhythm control as first-line therapy",
            "IV metoprolol or diltiazem for rate control plus initiation of a DOAC",
            "Observation only; anticoagulation is not required until AF persists >48 hours",
        ],
        "correct_option": 2,
        "explanation": (
            "Rate control is the initial priority for haemodynamically stable AF with "
            "rapid ventricular response; IV metoprolol or diltiazem targets HR <110 bpm. "
            "A CHA₂DS₂-VASc score ≥2 mandates anticoagulation regardless of AF duration; "
            "a DOAC (e.g., apixaban) should be started promptly. Cardioversion without "
            "anticoagulation risks systemic embolism from LA thrombus and is only safe if "
            "AF onset is definitively ≤48 h AND appropriate anticoagulation or TOE "
            "exclusion of thrombus has been performed. Amiodarone is used for rhythm "
            "control, not as immediate first-line therapy in stable patients."
        ),
    },
    # ── case_cardiology_003 — Severe Aortic Stenosis ────────────────────────
    {
        "case_question_id": "cq_case_cardiology_003_s1",
        "case_id": "case_cardiology_003",
        "step": 1,
        "stem": (
            "A 75-year-old man with a known bicuspid aortic valve presents with two "
            "episodes of exertional syncope and progressive dyspnoea. Exam reveals a "
            "slow-rising carotid pulse and a grade 4/6 crescendo-decrescendo systolic "
            "murmur at the right upper sternal border radiating to the carotids. "
            "Echocardiogram shows AVA 0.7 cm² and mean gradient 52 mmHg. "
            "What is the most likely diagnosis?"
        ),
        "options": [
            "Hypertrophic obstructive cardiomyopathy (HOCM)",
            "Mitral regurgitation",
            "Severe calcific aortic stenosis",
            "Pulmonary stenosis",
        ],
        "correct_option": 2,
        "explanation": (
            "Severe aortic stenosis is defined as AVA <1.0 cm² (critical <0.6 cm²) or "
            "mean gradient >40 mmHg. This patient has AVA 0.7 cm² and mean gradient "
            "52 mmHg, meeting criteria for severe AS. The murmur is crescendo-decrescendo "
            "at the RUSB radiating to carotids with a slow-rising pulse (pulsus parvus et "
            "tardus) — classic for AS. HOCM produces a dynamic murmur that decreases with "
            "squatting. Mitral regurgitation is a holosystolic murmur at the apex. "
            "Pulmonary stenosis murmur is heard at the left upper sternal border."
        ),
    },
    {
        "case_question_id": "cq_case_cardiology_003_s2",
        "case_id": "case_cardiology_003",
        "step": 2,
        "stem": (
            "The heart valve team determines the patient is intermediate surgical risk "
            "(STS score 4.5%). He has symptomatic severe AS (syncope, dyspnoea) with EF "
            "45%. Which is the most appropriate intervention?"
        ),
        "options": [
            "Balloon aortic valvuloplasty as definitive treatment",
            "Transcatheter aortic valve replacement (TAVR)",
            "Initiate ACE inhibitor and repeat echo in 6 months",
            "Surgical aortic valve replacement (SAVR) via full sternotomy only",
        ],
        "correct_option": 1,
        "explanation": (
            "Transcatheter aortic valve replacement (TAVR) is indicated for symptomatic "
            "severe AS in patients at intermediate or high surgical risk; multiple RCTs "
            "(PARTNER, SURTAVI) have demonstrated non-inferiority or superiority to SAVR "
            "in these risk groups. Medical management does not alter the natural history of "
            "severe symptomatic AS (median survival <2–3 years without intervention). "
            "Balloon aortic valvuloplasty provides only temporary relief and is used as a "
            "bridge in haemodynamically unstable patients. SAVR remains an option for "
            "low-risk patients or those with anatomical contraindications to TAVR."
        ),
    },
    # ── case_pulmonology_001 — COPD Exacerbation ────────────────────────────
    {
        "case_question_id": "cq_case_pulmonology_001_s1",
        "case_id": "case_pulmonology_001",
        "step": 1,
        "stem": (
            "A 72-year-old man with known GOLD stage III COPD presents with 3 days of "
            "worsening dyspnoea, increased purulent sputum, and inability to complete "
            "sentences. SpO2 84% on room air. ABG shows pH 7.31, PaCO2 58 mmHg, PaO2 "
            "48 mmHg, HCO3 28. CXR shows hyperinflation without consolidation. "
            "What is the most likely diagnosis?"
        ),
        "options": [
            "Community-acquired pneumonia with sepsis",
            "Acute exacerbation of COPD (AECOPD) with type 2 respiratory failure",
            "Spontaneous pneumothorax",
            "Acute pulmonary oedema",
        ],
        "correct_option": 1,
        "explanation": (
            "Acute exacerbation of COPD is defined as an acute worsening of respiratory "
            "symptoms beyond normal day-to-day variation requiring a change in therapy. "
            "The ABG demonstrates type 2 respiratory failure (elevated PaCO2 58 mmHg) "
            "with a compensatory metabolic alkalosis (elevated HCO3 28), indicating "
            "chronic CO2 retention with an acute-on-chronic decompensation. The purulent "
            "sputum and neutrophilia suggest a bacterial trigger (Gram-positive diplococci "
            "consistent with Streptococcus pneumoniae). No consolidation on CXR argues "
            "against primary pneumonia. No pneumothorax is seen."
        ),
    },
    {
        "case_question_id": "cq_case_pulmonology_001_s2",
        "case_id": "case_pulmonology_001",
        "step": 2,
        "stem": (
            "The patient is on controlled O2 (SpO2 now 90%) but remains tachypnoeic at "
            "RR 28 and repeat ABG shows pH 7.33, PaCO2 54 mmHg. He is alert and "
            "co-operative. Which is the most appropriate next ventilatory intervention?"
        ),
        "options": [
            "Immediate endotracheal intubation and invasive mechanical ventilation",
            "Non-invasive ventilation (BiPAP) targeting pH normalisation and PaCO2 reduction",
            "High-flow nasal cannula (HFNC) at 60 L/min",
            "Continue current therapy; the ABG is acceptable and no further intervention is needed",
        ],
        "correct_option": 1,
        "explanation": (
            "Non-invasive ventilation (NIV/BiPAP) is the evidence-based intervention for "
            "acute hypercapnic respiratory failure in COPD with pH <7.35 and PaCO2 >45 "
            "mmHg. It reduces the work of breathing, improves gas exchange, decreases "
            "intubation rates, and lowers mortality (multiple RCTs). It is appropriate "
            "here because the patient is alert, co-operative, and able to protect his "
            "airway. Immediate intubation carries higher risk and should be reserved for "
            "NIV failure or patients who cannot protect their airway. HFNC is less "
            "established for hypercapnic failure. Continuing current therapy is "
            "insufficient given ongoing acidaemia."
        ),
    },
    # ── case_pulmonology_002 — Massive Pulmonary Embolism ───────────────────
    {
        "case_question_id": "cq_case_pulmonology_002_s1",
        "case_id": "case_pulmonology_002",
        "step": 1,
        "stem": (
            "A 48-year-old woman, 3 weeks post-right total knee replacement, presents "
            "with sudden severe dyspnoea, pleuritic chest pain, and near-syncope. BP is "
            "82/50, HR 132, SpO2 80% on 15 L O2. JVP is markedly elevated with a right "
            "ventricular heave. Right leg is swollen. Bedside echo shows RV dilatation "
            "and a 'D-sign'. CTPA reveals bilateral massive central pulmonary emboli. "
            "What is the most likely unifying diagnosis?"
        ),
        "options": [
            "Tension pneumothorax",
            "Acute right heart failure secondary to massive bilateral pulmonary embolism",
            "Septic shock from wound infection",
            "Cardiogenic shock from perioperative STEMI",
        ],
        "correct_option": 1,
        "explanation": (
            "Massive PE is defined by haemodynamic instability (SBP <90 mmHg or shock). "
            "This patient has the classic post-operative risk profile, signs of acute right "
            "heart strain (elevated JVP, RV heave, RV dilatation with D-sign on echo — "
            "indicating right-to-left interventricular septal shift), and CTPA-confirmed "
            "bilateral massive emboli. Troponin elevation and BNP >900 pg/mL confirm RV "
            "myocardial damage. Tension pneumothorax would show absent breath sounds and "
            "tracheal deviation. Cardiogenic shock from STEMI would show LV dysfunction "
            "rather than isolated RV failure."
        ),
    },
    {
        "case_question_id": "cq_case_pulmonology_002_s2",
        "case_id": "case_pulmonology_002",
        "step": 2,
        "stem": (
            "There are no absolute contraindications to thrombolysis (no recent surgery "
            "within 10 days, no active bleeding, no history of haemorrhagic stroke). "
            "The patient remains hypotensive despite IV fluids. What is the most "
            "appropriate definitive treatment?"
        ),
        "options": [
            "Anticoagulation with IV unfractionated heparin alone and admission to HDU",
            "Systemic thrombolysis with IV alteplase 100 mg over 2 hours plus anticoagulation",
            "Subcutaneous enoxaparin at therapeutic dose and urgent haematology review",
            "IVC filter insertion and observation",
        ],
        "correct_option": 1,
        "explanation": (
            "Systemic thrombolysis (IV alteplase 100 mg over 2 hours) is the treatment of "
            "choice for haemodynamically unstable (massive) PE without absolute "
            "contraindications. It rapidly lyses clot, reduces RV afterload, and improves "
            "haemodynamics. UFH should be given before and after thrombolysis. For massive "
            "PE, the risk-benefit of thrombolysis clearly favours treatment given the "
            "30-day mortality of 25–65%. Anticoagulation alone is insufficient in massive "
            "PE with shock. Enoxaparin is not recommended in haemodynamic instability as "
            "its onset is slower and dose cannot be reversed. IVC filters do not treat "
            "existing thrombus."
        ),
    },
]


def seed(collection: Collection) -> None:
    existing_ids: set[str] = {
        doc["case_question_id"]
        for doc in collection.find({}, {"case_question_id": 1, "_id": 0})
    }

    to_insert = [q for q in CASE_QUESTIONS if q["case_question_id"] not in existing_ids]

    if not to_insert:
        print("All case questions already present — nothing to insert.")
        return

    collection.insert_many(to_insert)
    print(f"Inserted {len(to_insert)} case question(s). Skipped {len(CASE_QUESTIONS) - len(to_insert)}.")


def main() -> None:
    client = MongoClient(MONGO_URI)
    db = client.get_default_database()
    collection: Collection = db["case_questions"]

    # Ensure unique index on case_question_id
    collection.create_index([("case_question_id", ASCENDING)], unique=True)
    # Index to support GET /cases/{case_id}/questions efficiently
    collection.create_index([("case_id", ASCENDING), ("step", ASCENDING)])

    seed(collection)
    client.close()


if __name__ == "__main__":
    main()
