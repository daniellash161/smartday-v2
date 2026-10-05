# SmartDay

### Personal Productivity & Schedule Intelligence Platform

A Hebrew-first, client-side application that brings calendar events, important emails, tasks, and payment insights into a unified daily view.

Its core is an in-browser document processing pipeline that converts credit-card statement PDFs into structured transactions using PDF.js and Tesseract.js OCR. Rule-based logic identifies recurring payments and installments, flags potentially unusual charges, and generates task suggestions from calendar context.

Google Calendar and Gmail integrations use read-only OAuth access. Document extraction and OCR run locally in the browser.

[Project website](https://daniellash161.github.io/smartday-v2/)

## Features

- View upcoming Google Calendar events and import calendars from ICS files.
- Surface important Gmail messages using read-only access.
- Organize tasks and generate preparation reminders from calendar events.
- Extract transactions from PDF card statements.
- Identify recurring payments, subscriptions, installments, and potentially unusual charges.
- Use a Hebrew interface with right-to-left layouts.

## From Documents to Structured Data

The document processing pipeline runs in the browser:

1. **Extract text:** PDF.js reads the document's text layer.
2. **Handle scans:** When insufficient text is available, pages are rendered and processed with Tesseract.js OCR, with Hebrew and English support.
3. **Parse transactions:** Provider-specific handling and text patterns extract dates, merchant names, and amounts.
4. **Analyze payments:** Rules identify recurring charges and installments. Statistical thresholds and keywords flag potentially unusual transactions.
5. **Review results:** Users can inspect extracted rows, correct them, and rerun the analysis.

This project integrates an existing OCR engine. Payment classification, task suggestions, and prioritization use rules rather than a custom-trained machine learning model.

## Technology

| Area | Tools |
| --- | --- |
| Interface | React, TypeScript |
| Development and build | Vite |
| PDF text extraction | PDF.js |
| Optical character recognition | Tesseract.js |
| Integrations | Google Calendar API, Gmail API, ICS import |
| Local persistence | Browser local storage |

## Run Locally

Install Node.js and npm, then run:

```bash
git clone https://github.com/daniellash161/smartday-v2.git
cd smartday-v2
npm ci
npm run dev
```

Open the local address printed by Vite.

### Optional Google Integrations

Google Calendar and Gmail require a configured Google OAuth client.

Create a `.env.local` file in the project root:

```env
VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id
```

Configure the relevant APIs, OAuth consent settings, and authorized JavaScript origins in your Google Cloud project. The authorized origin must match the address used to open the app.

Restart the development server after changing the environment file. Both integrations request read-only access.

### Other Commands

```bash
npm run build
npm run preview
npm run lint
```

## Project Structure

- `src/components/`: dashboard cards, document upload, and user interactions.
- `src/services/`: calendar, email, and news integrations.
- `src/utils/`: document extraction, transaction analysis, categorization, and reminders.
- `src/config/`: Google integration configuration.
- `src/types/`: shared TypeScript data types.

## Data Handling and Limitations

PDF extraction and OCR run locally in the browser. Google integrations communicate with Google's services after user authorization, and selected application data is saved in browser local storage.

Extraction quality depends on document layout, scan quality, and supported statement formats. Unusual-charge flags are prompts for review, not confirmation of an incorrect charge. Users should check extracted transactions against the original document.

## Project Context and Contribution

SmartDay was developed as a team project. Daniella Shemesh developed most of the application, including the document processing pipeline, rule-based payment analysis and task suggestions, and calendar and email integrations.

The project demonstrates practical experience in data extraction, structured transaction processing, application logic, and API integration.
