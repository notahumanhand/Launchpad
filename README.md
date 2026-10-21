# Application Launchpad

A small Flask launchpad for three Render-hosted demonstration applications. When a visitor opens the launchpad, it initiates health checks to all three services in parallel, displays each service's status, and provides a link to open it once it responds.

## Applications

### CaseFlow
A proof of concept for immigration-document workflow automation. It demonstrates document review, structured information extraction, comparison, and human review of potential discrepancies.

- **Stack:** Python, FastAPI, HTML/CSS/JavaScript, Google Gemini, `python-docx`
- **URL:** https://konaredemo.onrender.com/
- **Readiness check:** `/api/cases/MG-2026-001/documents` (does not invoke Gemini)

### Commonthread
A synthetic university advancement analytics dashboard for fundraising activity, donor behavior, campaign timing, and gift-level records.

- **Stack:** Python, Flask, SQLite, HTML/CSS/JavaScript
- **URL:** https://commonthread-xrub.onrender.com/
- **Health check:** `/health`

### VeriFHIR
A Streamlit proof of concept that compares FHIR R4 observations with evidence in synthetic EHR screenshots using OCR.

- **Stack:** Python, Streamlit, FHIR R4, Azure AI Vision, pandas, Pillow
- **URL:** https://verifhir-s05f.onrender.com/
- **Health check:** `/_stcore/health`

## Behavior

1. The launchpad homepage renders immediately.
2. Browser JavaScript requests `POST /api/wake`.
3. The launchpad contacts all three target endpoints concurrently. An HTTP request to a sleeping Render free service triggers its startup.
4. Status cards update by polling `GET /api/status`.
5. Once a target responds successfully, its card is marked **Online** and the visitor can open it.
6. If a service cannot be reached, its card displays an unavailable state and offers a retry.

The launchpad does not proxy application traffic or embed the applications. The links open the target sites directly.

## Render deployment

1. Create a new GitHub repository, for example `application-launchpad`.
2. Extract this project into the repository root and push the files to GitHub.
3. In Render, choose **New → Blueprint** and connect the repository. Render reads `render.yaml`.
4. Confirm the service uses the **Starter** instance plan (currently $7/month) and deploy.
5. Open the launchpad's Render URL. On first visit, the cards should begin checking all three applications.
6. If you prefer to create a Web Service manually, use:
   - **Runtime:** Python
   - **Build command:** `pip install -r requirements.txt`
   - **Start command:** `gunicorn app:app --workers 2 --threads 4 --timeout 180`
   - **Health check path:** `/health`
   - Add the three environment variables described below if your URLs change.

### Environment variables

| Variable | Default |
|---|---|
| `CASEFLOW_URL` | `https://konaredemo.onrender.com` |
| `COMMONTHREAD_URL` | `https://commonthread-xrub.onrender.com` |
| `VERIFHIR_URL` | `https://verifhir-s05f.onrender.com` |

These URLs are configurable in Render's environment settings. The service URLs are kept server-side and are not accepted from browser input.

## Local development

Requires Python 3.11+.

```bash
python -m venv .venv
# Windows PowerShell:
.venv\Scripts\Activate.ps1
# macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt
python app.py
```

Open http://127.0.0.1:10000.

## Notes and limitations

- Render free web services spin down after 15 minutes without inbound traffic. The next request starts the service, which may take about a minute. The launchpad triggers this startup but cannot eliminate cold-start time.
- Health checks run in background threads and retry for up to 150 seconds. If a target takes longer, the card shows an unavailable state and the user can retry.
- **CaseFlow:** the supplied project archive does not define a dedicated `/health` route. This launchpad uses the existing document-list endpoint as a readiness check; it avoids the Gemini test endpoint because that would call an external AI API.
- **VeriFHIR:** `/_stcore/health` is Streamlit's health endpoint. Its actual status should be verified against the deployed instance.
- A successful HTTP response means the configured endpoint responded; it does not guarantee every feature or external dependency is functioning.
- This app does not require API keys for the three targets. Keep any credentials used by the target applications in their own Render environment settings.
- Status is stored in process memory and resets when the launchpad restarts. No database is needed for this use case.
- Do not add periodic keep-alive pings. The intended behavior is to wake services when someone visits the launchpad.
- The launchpad is a navigation and status tool, not an authentication boundary. The linked applications remain publicly accessible according to their own configurations.

## Project files

```text
.
├── app.py
├── requirements.txt
├── render.yaml
├── README.md
├── .gitignore
├── templates/
│   └── index.html
└── static/
    ├── css/
    │   └── styles.css
    └── js/
        └── dashboard.js
```
