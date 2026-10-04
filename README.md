# Buddy — University Learning AI Prototype

Buddy is a competition-focused university study AI prototype with three core ideas:

1. **Attempt-first AI Tutor** — students submit their thinking before Buddy gives meaningful help.
2. **PDF → Study Kit** — upload lecture material and generate smart notes, flashcards and a quiz.
3. **Active recall workflow** — generated flashcards and quizzes turn passive reading into practice.

## Run locally

```bash
py -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

Copy `.env.example` to `.env` and set your API key:

```text
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-5.6-luna
```

Then:

```bash
python app.py
```

Open `http://127.0.0.1:5000`.

## Competition demo flow

**Demo 1 — Tutor:** ask a calculation/concept question, show that Buddy asks for an attempt, submit a wrong or partial attempt, then show the targeted coaching.

**Demo 2 — PDF:** upload one real lecture PDF, generate Smart Notes, then generate Flashcards and Quiz.

**Demo 3 — Value proposition:** explain that Buddy's core innovation is not another chatbot; it is an AI workflow designed around learning behaviour.

## Important

This is a prototype. Do not expose the API key in frontend code or commit `.env` to a public repository.
