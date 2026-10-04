import json
import os
from flask import Flask, render_template, request, jsonify
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()
app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 20 * 1024 * 1024

client = OpenAI(api_key=os.getenv('OPENAI_API_KEY')) if os.getenv('OPENAI_API_KEY') else None
MODEL = os.getenv('OPENAI_MODEL', 'gpt-5.6-luna')

BRAND = 'Buddy'

TUTOR_SYSTEM = '''You are Buddy, an academic learning coach for university students.
Your defining principle is ATTEMPT FIRST. Buddy must protect learning integrity: do not immediately provide a final answer to a homework or academic problem.
If the student has not attempted the question, ask for their first step, relevant concept, formula, diagram, reasoning, or best guess. Never solve the problem in that first response.
After the student attempts it, diagnose their reasoning. Identify what is correct, then give one targeted hint or the next step. Ask a short follow-up when that will help them continue independently.
Only give a complete worked solution when the student has made a genuine attempt and either asks for the solution or has reached the point where a worked solution is educationally appropriate.
Use university-level accuracy, clear step-by-step reasoning, equations and units for calculations, and explain why a step is taken. Never shame a wrong answer. Your goal is understanding, not simply task completion.'''

NOTE_SYSTEM = '''You are Buddy, a university study-material assistant. Use ONLY the supplied PDF as the factual source. Create concise, exam-useful notes for a university student.
Structure the notes with: topic overview, key concepts, definitions, important relationships/formulas, worked/example ideas when supported by the PDF, common mistakes or distinctions, and an exam checklist when relevant.
Do not invent facts, examples, page content, or references that are not supported by the PDF. If the PDF is incomplete, say what is missing.'''

FLASH_SYSTEM = '''You are Buddy, a university active-recall generator. Use ONLY the supplied PDF.
Return valid JSON and nothing else in this exact shape:
{"title":"...","cards":[{"front":"...","back":"..."}]}
Generate 12 cards unless the source is very short. Mix definitions, concepts, relationships, formulas, applications, and common misconceptions. Each card should test one idea. Keep answers concise and accurate. Do not invent content.'''

QUIZ_SYSTEM = '''You are Buddy, a university assessment generator. Use ONLY the supplied PDF.
Return valid JSON and nothing else in this exact shape:
{"title":"...","questions":[{"question":"...","options":["A...","B...","C...","D..."],"answer":0,"explanation":"..."}]}
Generate 10 multiple-choice questions. Mix recall, understanding and application. The answer is the zero-based index of the correct option. Explanations must be short and grounded in the PDF. Do not invent content.'''

CHAT_SYSTEM = '''You are Buddy, a university study assistant. Explain concepts clearly and encourage active recall. For assignment/homework questions, use the same attempt-first rule: ask for the student's thinking before giving a complete solution. Avoid doing assessed work entirely for the student when no attempt is provided.'''


def require_client():
    if not client:
        raise RuntimeError('OPENAI_API_KEY is not configured. Add it to .env.')


def ask(text, system, file_id=None):
    require_client()
    content = [{'type': 'input_text', 'text': text}]
    if file_id:
        content.insert(0, {'type': 'input_file', 'file_id': file_id})
    response = client.responses.create(
        model=MODEL,
        instructions=system,
        input=[{'role': 'user', 'content': content}],
    )
    return response.output_text


def clean_json(raw):
    raw = raw.strip()
    if raw.startswith('```'):
        raw = raw.split('\n', 1)[1] if '\n' in raw else raw
        if raw.endswith('```'):
            raw = raw[:-3]
    return json.loads(raw.strip())


@app.route('/')
def index():
    return render_template('index.html')


@app.get('/api/health')
def health():
    return jsonify({'ok': True, 'configured': bool(client), 'model': MODEL, 'name': BRAND})


@app.post('/api/tutor')
def tutor():
    data = request.get_json(force=True)
    question = (data.get('question') or '').strip()
    attempt = (data.get('attempt') or '').strip()
    stage = data.get('stage', 'first')
    if not question:
        return jsonify({'error': 'Enter an academic question first.'}), 400
    if stage == 'first':
        prompt = f'''The student asked: {question}\n\nThey have NOT submitted an attempt yet. Respond with encouragement and one focused request for their first step, concept, formula, explanation, or best guess. Do not solve the question or reveal the final answer.'''
    else:
        prompt = f'''Academic question: {question}\n\nStudent's attempt: {attempt}\n\nCoach the student. Start by identifying what they did correctly, if anything. Then give the smallest useful hint or next step. If the attempt is wrong, explain the misconception without jumping straight to the final answer. If they explicitly ask for the complete solution, provide a worked solution after the feedback, with reasoning and equations.'''
    try:
        return jsonify({'answer': ask(prompt, TUTOR_SYSTEM)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.post('/api/upload')
def upload():
    require_client()
    f = request.files.get('file')
    if not f or not f.filename.lower().endswith('.pdf'):
        return jsonify({'error': 'Please upload a PDF file.'}), 400
    try:
        uploaded = client.files.create(file=(f.filename, f.stream, 'application/pdf'), purpose='user_data')
        return jsonify({'file_id': uploaded.id, 'filename': f.filename})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.post('/api/study-kit')
def study_kit():
    data = request.get_json(force=True)
    file_id = data.get('file_id')
    kind = data.get('kind', 'notes')
    if not file_id:
        return jsonify({'error': 'Upload a PDF first.'}), 400
    systems = {'notes': NOTE_SYSTEM, 'flashcards': FLASH_SYSTEM, 'quiz': QUIZ_SYSTEM}
    prompts = {
        'notes': 'Create the Smart Notes from this PDF.',
        'flashcards': 'Generate the flashcard deck from this PDF.',
        'quiz': 'Generate the quiz from this PDF.'
    }
    if kind not in systems:
        return jsonify({'error': 'Unknown study-kit type.'}), 400
    try:
        raw = ask(prompts[kind], systems[kind], file_id)
        if kind in {'flashcards', 'quiz'}:
            try:
                return jsonify({'result': clean_json(raw), 'kind': kind})
            except json.JSONDecodeError:
                return jsonify({'result': raw, 'kind': kind, 'raw': True})
        return jsonify({'result': raw, 'kind': kind})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.post('/api/chat')
def chat():
    data = request.get_json(force=True)
    message = (data.get('message') or '').strip()
    context = data.get('context', '')
    if not message:
        return jsonify({'error': 'Enter a message.'}), 400
    try:
        answer = ask(f'Context: {context}\n\nStudent: {message}', CHAT_SYSTEM)
        return jsonify({'answer': answer})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True, port=int(os.getenv('PORT', 5000)))
