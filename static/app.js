let currentView = "home";

let tutorStage = "first";
let tutorQuestion = "";

let pdfFileId = null;
let pdfName = "";

let lastNotes = "";
let lastFlashcards = null;
let lastQuiz = null;


const $ = (id) => document.getElementById(id);


const viewNames = {
    home: "Overview",
    tutor: "AI Tutor",
    study: "Study Kit",
    notes: "My Notes",
    quiz: "Practice"
};


/* ============================= */
/* NAVIGATION */
/* ============================= */

document.querySelectorAll(".nav-item").forEach((item) => {

    item.addEventListener("click", () => {
        showView(item.dataset.view);
    });

});


function showView(view) {

    document.querySelectorAll(".view").forEach((section) => {
        section.classList.remove("active-view");
    });


    const target = $(view);

    if (target) {
        target.classList.add("active-view");
    }


    document.querySelectorAll(".nav-item").forEach((item) => {

        item.classList.toggle(
            "active",
            item.dataset.view === view
        );

    });


    $("breadcrumbCurrent").textContent =
        viewNames[view] || view;


    currentView = view;


    if (window.innerWidth <= 780) {
        $("sidebar").classList.remove("open");
    }


    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}


/* ============================= */
/* SIDEBAR */
/* ============================= */

function toggleSidebar() {

    $("sidebar").classList.toggle("open");

}


/* ============================= */
/* THEME */
/* ============================= */

function toggleTheme() {

    document.body.classList.toggle("dark");

    localStorage.setItem(
        "buddyTheme",
        document.body.classList.contains("dark")
            ? "dark"
            : "light"
    );

}


if (localStorage.getItem("buddyTheme") === "dark") {
    document.body.classList.add("dark");
}


/* ============================= */
/* UTILITIES */
/* ============================= */

function escapeHtml(value) {

    return String(value ?? "").replace(
        /[&<>'"]/g,
        (character) => {

            const map = {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                "'": "&#39;",
                '"': "&quot;"
            };

            return map[character];

        }
    );

}


function toast(message) {

    const element = $("toast");

    element.textContent = message;

    element.classList.add("show");

    setTimeout(() => {
        element.classList.remove("show");
    }, 2800);

}


/* ============================= */
/* AI TUTOR */
/* ============================= */

function useQuestion(question) {

    showView("tutor");

    $("question").value = question;

    $("question").focus();

}


function resetTutor() {

    tutorStage = "first";
    tutorQuestion = "";

    $("question").value = "";

    $("question").placeholder =
        "Ask a university question...";


    $("tutorMessages").innerHTML = `

        <div class="message ai-message">

            <div class="message-avatar">
                B
            </div>

            <div class="message-body">

                <span class="message-name">
                    Buddy
                </span>

                <p>
                    New session started.
                    Give me a university question
                    and I’ll ask for your first step
                    before we solve it together.
                </p>

            </div>

        </div>

    `;


    setBusy(false);

}


function addMessage(text, type = "ai") {

    const wrapper = document.createElement("div");

    wrapper.className =
        type === "user"
            ? "message user-message"
            : "message ai-message";


    const avatar =
        type === "user"
            ? "A"
            : "B";


    const sender =
        type === "user"
            ? "You"
            : "Buddy";


    wrapper.innerHTML = `

        <div class="message-avatar">
            ${avatar}
        </div>

        <div class="message-body">

            <span class="message-name">
                ${sender}
            </span>

            <p>
                ${escapeHtml(text).replace(/\n/g, "<br>")}
            </p>

        </div>

    `;


    $("tutorMessages").appendChild(wrapper);


    $("tutorMessages").scrollTop =
        $("tutorMessages").scrollHeight;
}


async function startTutor() {

    const input = $("question");

    const value = input.value.trim();


    if (!value) {

        toast(
            tutorStage === "first"
                ? "Give Buddy a question first."
                : "Buddy needs your attempt first."
        );

        return;
    }


    addMessage(value, "user");

    input.value = "";

    setBusy(true);


    try {

        let body;


        if (tutorStage === "first") {

            tutorQuestion = value;

            body = {
                question: tutorQuestion,
                stage: "first"
            };

        } else {

            body = {
                question: tutorQuestion,
                attempt: value,
                stage: "attempt"
            };

        }


        const response = await fetch(
            "/api/tutor",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify(body)
            }
        );


        const data = await response.json();


        if (data.error) {
            throw new Error(data.error);
        }


        addMessage(data.answer);


        if (tutorStage === "first") {

            tutorStage = "attempt";

            input.placeholder =
                "Now give Buddy your first step, formula, explanation, or best guess...";

        }


    } catch (error) {

        addMessage(
            "I couldn't reach Buddy's AI service. " +
            error.message
        );

    } finally {

        setBusy(false);

    }

}


function setBusy(isBusy) {

    const button = $("tutorBtn");


    button.disabled = isBusy;


    if (isBusy) {

        button.innerHTML =
            "Buddy is thinking...";

    } else if (tutorStage === "first") {

        button.innerHTML =
            'Ask Buddy <span>→</span>';

    } else {

        button.innerHTML =
            'Send attempt <span>→</span>';

    }

}


$("question").addEventListener(
    "keydown",
    (event) => {

        if (
            event.key === "Enter" &&
            !event.shiftKey
        ) {

            event.preventDefault();

            startTutor();

        }

    }
);


/* ============================= */
/* PDF UPLOAD */
/* ============================= */

function handleDrop(event) {

    event.preventDefault();

    $("dropzone").classList.remove("dragging");

    const file =
        event.dataTransfer.files[0];

    handleFile(file);

}


async function handleFile(file) {

    if (!file) {
        return;
    }


    if (
        file.type !==
        "application/pdf"
    ) {

        toast(
            "Please upload a PDF file."
        );

        return;
    }


    if (
        file.size >
        20 * 1024 * 1024
    ) {

        toast(
            "Keep the PDF under 20 MB."
        );

        return;
    }


    $("uploadTitle").textContent =
        "Uploading...";

    $("uploadSub").textContent =
        file.name;


    try {

        const formData =
            new FormData();

        formData.append(
            "file",
            file
        );


        const response =
            await fetch(
                "/api/upload",
                {
                    method: "POST",
                    body: formData
                }
            );


        const data =
            await response.json();


        if (data.error) {
            throw new Error(data.error);
        }


        pdfFileId =
            data.file_id;

        pdfName =
            data.filename;


        $("uploadTitle").textContent =
            "PDF ready";


        $("uploadSub").textContent =
            "Choose how you want Buddy to transform it.";


        $("fileName").textContent =
            pdfName;


        $("fileReady")
            .classList
            .remove("hidden");


        $("studyActions")
            .classList
            .remove("hidden");


        toast(
            "PDF uploaded successfully."
        );


    } catch (error) {

        $("uploadTitle").textContent =
            "Upload failed";

        $("uploadSub").textContent =
            error.message;


        toast(error.message);

    }

}


function clearPdf(event) {

    event.stopPropagation();


    pdfFileId = null;
    pdfName = "";


    $("fileReady")
        .classList
        .add("hidden");


    $("studyActions")
        .classList
        .add("hidden");


    $("uploadTitle").textContent =
        "Drop your lecture PDF here";


    $("uploadSub").textContent =
        "or click anywhere to browse";


    $("pdfInput").value = "";

}


/* ============================= */
/* STUDY KIT */
/* ============================= */

async function generateKit(kind) {

    if (!pdfFileId) {

        toast(
            "Upload a PDF first."
        );

        return;
    }


    const output =
        $("studyOutput");


    output.classList.remove("hidden");


    output.innerHTML = `

        <div class="loading">

            <div class="spinner"></div>

            <div>

                <b>
                    Buddy is reading your PDF...
                </b>

                <p>
                    Creating ${kind}
                    from ${escapeHtml(pdfName)}.
                </p>

            </div>

        </div>

    `;


    try {

        const response =
            await fetch(
                "/api/study-kit",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        file_id:
                            pdfFileId,

                        kind:
                            kind
                    })
                }
            );


        const data =
            await response.json();


        if (data.error) {
            throw new Error(data.error);
        }


        renderResult(
            data.result,
            kind
        );


    } catch (error) {

        output.innerHTML = `

            <div class="loading">

                <div>
                    <b>
                        Something went wrong.
                    </b>

                    <p>
                        ${escapeHtml(error.message)}
                    </p>
                </div>

            </div>

        `;

    }

}


/* ============================= */
/* RENDER RESULT */
/* ============================= */

function renderResult(result, kind) {

    if (kind === "notes") {

        lastNotes =
            String(result);


        const html = `

            <div class="result-head">

                <div>

                    <div class="result-label">
                        SMART NOTES
                    </div>

                    <h2>
                        ${escapeHtml(pdfName)}
                    </h2>

                </div>

                <button
                    class="outline-button"
                    onclick="showView('notes')"
                >
                    Open Notes
                </button>

            </div>

            <div class="notes-body">

                ${markdownish(lastNotes)}

            </div>

        `;


        $("notesContent").innerHTML =
            html;


        $("notesContent")
            .classList
            .remove("hidden");


        $("notesEmpty")
            .classList
            .add("hidden");


        $("studyOutput").innerHTML =
            html;


        toast(
            "Smart Notes created."
        );


        return;
    }


    if (kind === "flashcards") {

        let data =
            typeof result === "string"
                ? JSON.parse(result)
                : result;


        lastFlashcards =
            data;


        renderFlashcards(data);


        toast(
            "Flashcards created."
        );


        return;
    }


    if (kind === "quiz") {

        let data =
            typeof result === "string"
                ? JSON.parse(result)
                : result;


        lastQuiz =
            data;


        renderQuiz(data);


        toast(
            "Practice quiz created."
        );

    }

}


/* ============================= */
/* FLASHCARDS */
/* ============================= */

function renderFlashcards(data) {

    const cards =
        data.cards || [];


    $("studyOutput").innerHTML = `

        <div class="result-head">

            <div>

                <div class="result-label">
                    ACTIVE RECALL
                </div>

                <h2>
                    ${escapeHtml(
                        data.title ||
                        "Buddy Flashcards"
                    )}
                </h2>

            </div>

            <span class="count-pill">
                ${cards.length} cards
            </span>

        </div>


        <div class="flashcard-grid">

            ${cards.map(
                (card, index) => `

                    <button
                        class="flashcard"
                        onclick="this.classList.toggle('flipped')"
                    >

                        <span class="card-number">
                            ${String(index + 1).padStart(2, "0")}
                        </span>

                        <strong>
                            ${escapeHtml(card.front)}
                        </strong>

                        <small>
                            Click to reveal
                        </small>

                        <span class="back">
                            ${escapeHtml(card.back)}
                        </span>

                    </button>

                `
            ).join("")}

        </div>

    `;

}


/* ============================= */
/* QUIZ */
/* ============================= */

function renderQuiz(data) {

    const questions =
        data.questions || [];


    const html = `

        <div class="result-head">

            <div>

                <div class="result-label">
                    RETRIEVAL PRACTICE
                </div>

                <h2>
                    ${escapeHtml(
                        data.title ||
                        "Buddy Practice"
                    )}
                </h2>

            </div>

            <span class="count-pill">
                ${questions.length} questions
            </span>

        </div>


        <div id="quizBox">

            ${questions.map(
                (question, index) => `

                    <div
                        class="quiz-q"
                        data-answer="${Number(
                            question.answer
                        )}"
                    >

                        <div class="q-number">
                            Question ${index + 1}
                        </div>

                        <b>
                            ${escapeHtml(
                                question.question
                            )}
                        </b>


                        <div class="options">

                            ${(question.options || [])
                                .map(
                                    (option, optionIndex) => `

                                        <label>

                                            <input
                                                type="radio"
                                                name="q${index}"
                                                value="${optionIndex}"
                                            >

                                            <span>
                                                ${escapeHtml(option)}
                                            </span>

                                        </label>

                                    `
                                )
                                .join("")}

                        </div>


                        <small class="explanation">
                            ${escapeHtml(
                                question.explanation || ""
                            )}
                        </small>

                    </div>

                `
            ).join("")}


            <button
                class="button primary-button"
                onclick="gradeQuiz()"
            >
                Check my answers
                <span>→</span>
            </button>

        </div>

    `;


    $("studyOutput").innerHTML =
        html;


    $("quizContent").innerHTML =
        html;


    $("quizContent")
        .classList
        .remove("hidden");


    $("quizEmpty")
        .classList
        .add("hidden");

}


function gradeQuiz() {

    const questions =
        document.querySelectorAll(
            "#quizBox .quiz-q"
        );


    let score = 0;


    questions.forEach(
        (question) => {

            const selected =
                question.querySelector(
                    "input:checked"
                );


            question.classList.remove(
                "correct",
                "incorrect"
            );


            if (
                selected &&
                Number(selected.value) ===
                Number(question.dataset.answer)
            ) {

                score++;

                question.classList.add(
                    "correct"
                );

            } else {

                question.classList.add(
                    "incorrect"
                );

            }

        }
    );


    const previous =
        document.querySelector(
            "#quizBox .score-banner"
        );


    if (previous) {
        previous.remove();
    }


    const banner =
        document.createElement("div");


    banner.className =
        "score-banner";


    const total =
        questions.length;


    let message;


    if (score === total) {

        message =
            "Excellent recall.";

    } else if (
        score >= total * .7
    ) {

        message =
            "Good work. Review what you missed.";

    } else {

        message =
            "Keep going. Revisit your notes and try again.";

    }


    banner.innerHTML = `

        <span>
            Your score
        </span>

        <strong>
            ${score}/${total}
        </strong>

        <small>
            ${message}
        </small>

    `;


    $("quizBox").prepend(
        banner
    );


    toast(
        `You scored ${score}/${total}`
    );

}


/* ============================= */
/* MARKDOWN-LIKE NOTES */
/* ============================= */

function markdownish(text) {

    let output =
        escapeHtml(text);


    output =
        output.replace(
            /^### (.*)$/gm,
            "<h3>$1</h3>"
        );


    output =
        output.replace(
            /^## (.*)$/gm,
            "<h2>$1</h2>"
        );


    output =
        output.replace(
            /^# (.*)$/gm,
            "<h2>$1</h2>"
        );


    output =
        output.replace(
            /\*\*(.*?)\*\*/g,
            "<strong>$1</strong>"
        );


    output =
        output.replace(
            /^- (.*)$/gm,
            "<li>$1</li>"
        );


    output =
        output.replace(
            /\n\n/g,
            "</p><p>"
        );


    output =
        output.replace(
            /\n/g,
            "<br>"
        );


    return `<p>${output}</p>`;

}