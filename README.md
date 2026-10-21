# Software Engineering Portfolio Launchpad

A lightweight Flask portfolio homepage for independently hosted software demonstrations. It introduces each project to recruiters and hiring managers, summarizes its purpose and technology stack, checks service availability, and links directly to each live application.

## Featured projects

### CaseFlow — Immigration Workflow Automation Demonstration
A proof of concept for organizing document-heavy case review into a structured workflow. It demonstrates extracting information from fictional supporting records, comparing information across documents, and directing potential discrepancies to a human reviewer.

- **Technology summary:** Python, FastAPI, HTML/CSS/JavaScript, Google Gemini, `python-docx`
- **Live demonstration:** https://konaredemo.onrender.com/

### Commonthread — University Advancement Analytics
An interactive dashboard for exploring synthetic fundraising activity, donor behavior, campaign timing, and gift-level transactions. Includes filtered reporting, trends, campaign context, a raw-data explorer, and CSV export.

- **Technology stack:** Python, Flask, SQLite, HTML/CSS/JavaScript
- **Live demonstration:** https://commonthread-xrub.onrender.com/

### VeriFHIR — FHIR Source Validation
A proof of concept that compares observations in a FHIR R4 bundle with evidence in a synthetic EHR screenshot. Azure AI Vision performs OCR, while application code compares extracted values and units and highlights potential discrepancies for review.

- **Technology stack:** Python, Streamlit, FHIR R4, Azure AI Vision, pandas, Pillow
- **Live demonstration:** https://verifhir-s05f.onrender.com/

## Features

- Recruiter-oriented introduction and project summaries.
- Technology stack displayed for each project.
- Automatic health/readiness checks when a visitor arrives.
- Independent status cards so one slow application does not block the others.
- Direct links to each project and retry controls for failed checks.
- Responsive layout for desktop and mobile.
- Render Blueprint configuration.

Manual web service settings:

- **Runtime:** Python
- **Build command:** `pip install -r requirements.txt`
- **Start command:** `gunicorn app:app --workers 2 --threads 4 --timeout 180`
- **Health check path:** `/health`

## Service checks and known limitations

- Render free services can spin down after inactivity. A request to a sleeping service triggers startup, which can take around a minute. The launchpad remains responsive while checks run in the background.
- CaseFlow's supplied project does not have a dedicated `/health` route; the launchpad checks its existing document-list endpoint to avoid invoking the AI API.
- Commonthread is checked at `/health`.
- VeriFHIR is checked at Streamlit's `/_stcore/health` endpoint. Verify that this endpoint is accessible on the deployed service.
- An HTTP success indicates that the configured endpoint responded; it does not prove that every feature or dependency is working.
- All CaseFlow and VeriFHIR demo data is synthetic. Commonthread's bundled fundraising data is also synthetic. These projects are demonstrations and should not be represented as production legal, clinical, or institutional systems.
- The status is held in process memory and is not persisted across restarts.
- The launchpad does not proxy application traffic or provide authentication for the target sites.
