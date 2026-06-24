import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any


OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_IQ_MODEL = "openrouter/auto"
DEFAULT_FREE_IQ_MODEL = "openai/gpt-oss-20b:free"


def load_env_file() -> None:
    env_path = Path.cwd() / ".env.local"
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


def get_openrouter_key() -> str:
    return (
        os.environ.get("OPENROUTER_API_KEY")
        or os.environ.get("NEXT_PUBLIC_OPENROUTER_API_KEY")
        or ""
    )


def get_iq_model() -> str:
    return os.environ.get("IQ_MODEL") or os.environ.get("NEXT_PUBLIC_IQ_MODEL") or DEFAULT_IQ_MODEL


def get_free_iq_model() -> str:
    return (
        os.environ.get("OPENROUTER_FREE_IQ_MODEL")
        or os.environ.get("NEXT_PUBLIC_FREE_IQ_MODEL")
        or DEFAULT_FREE_IQ_MODEL
    )


def is_insufficient_credit_error(status_code: int, details: str) -> bool:
    normalized = details.lower()
    return status_code == 402 or "insufficient credits" in normalized or "purchase more" in normalized


def build_prompt(payload: dict[str, Any]) -> list[dict[str, str]]:
    mode = payload.get("mode") if payload.get("mode") in {"written", "voice"} else "written"
    class_level = payload.get("classLevel") or 10
    gender = str(payload.get("studentGender") or "not provided")
    count = int(payload.get("count") or 10)
    seed = str(payload.get("uniquenessSeed") or f"{mode}-{int(time.time() * 1000)}")
    previous_questions = payload.get("previousQuestions") or []
    previous_block = "\n".join(
        f"{index + 1}. {question}"
        for index, question in enumerate(previous_questions[-30:])
        if isinstance(question, str) and question.strip()
    )

    agent_name = "Written IQ Test Agent" if mode == "written" else "Voice IQ Test Agent"
    delivery_rules = (
        "Questions will be displayed on screen for reading."
        if mode == "written"
        else "Questions will be spoken aloud, so use concise wording that sounds natural when read by TTS."
    )

    system_prompt = f"""
You are the DexTest {agent_name}.
Create original IQ assessment questions for school students.
Return only valid JSON. No markdown, no commentary, no explanations.
""".strip()

    user_prompt = f"""
Generate exactly {count} unique IQ questions.

Student profile:
- Class: {class_level}
- Gender: {gender}

Attempt uniqueness seed: {seed}
Agent mode: {mode}
Delivery: {delivery_rules}

Rules:
- Use the student's class and gender only as context for age-appropriate, fair wording.
- Do not stereotype, personalize sensitive content, or change difficulty based on gender.
- Make each question unique for this attempt.
- Avoid repeating or lightly paraphrasing previous questions.
- Include a hidden correctAnswer field for scoring, but do not include explanations.
- Use a mix of logic, pattern recognition, numerical reasoning, verbal reasoning, and simple spatial reasoning.
- For voice mode, each question must be easy to understand when spoken once.

Previous questions to avoid:
{previous_block or "None"}

Return this exact JSON array shape:
[
  {{
    "id": "q1",
    "question": "question text",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": 0,
    "difficulty": "easy",
    "timeLimit": 60
  }}
]
""".strip()

    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]


def request_openrouter(model: str, messages: list[dict[str, str]], count: int) -> str:
    api_key = get_openrouter_key()
    if not api_key:
        raise RuntimeError("OpenRouter API key is not configured.")

    request_body = {
        "model": model,
        "messages": messages,
        "temperature": 0.78,
        "max_tokens": max(1600, count * 240),
    }

    request = urllib.request.Request(
        OPENROUTER_API_URL,
        data=json.dumps(request_body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://dextest.app",
            "X-Title": "DexTest Python IQ Agents",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        details = error.read().decode("utf-8", errors="replace")
        if is_insufficient_credit_error(error.code, details):
            raise PermissionError(details) from error
        raise RuntimeError(f"OpenRouter failed with {error.code}: {details}") from error

    content = (
        (payload.get("choices") or [{}])[0]
        .get("message", {})
        .get("content", "")
        .strip()
    )

    if not content:
        raise RuntimeError("OpenRouter returned no question content.")

    return content


def call_openrouter(messages: list[dict[str, str]], count: int) -> str:
    primary_model = get_iq_model()

    try:
        return request_openrouter(primary_model, messages, count)
    except PermissionError as error:
        free_model = get_free_iq_model()
        if free_model == primary_model:
            raise RuntimeError(f"OpenRouter failed with insufficient credits: {error}") from error

        print(
            json.dumps(
                {
                    "warning": "OpenRouter default model required credits. Retrying with configured free model.",
                    "primaryModel": primary_model,
                    "retryModel": free_model,
                }
            ),
            file=sys.stderr,
        )
        return request_openrouter(free_model, messages, count)


def extract_json_array(content: str) -> list[dict[str, Any]]:
    clean = content.replace("```json", "").replace("```", "").strip()
    start = clean.find("[")
    end = clean.rfind("]")

    if start < 0 or end <= start:
        raise RuntimeError("AI response did not contain a JSON array.")

    parsed = json.loads(clean[start : end + 1])
    if not isinstance(parsed, list):
        raise RuntimeError("AI response JSON was not an array.")

    return parsed


def normalize_questions(
    raw_questions: list[dict[str, Any]],
    count: int,
    seed: str,
) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []

    for index, question in enumerate(raw_questions[:count]):
        if not isinstance(question, dict):
            raise RuntimeError(f"Question {index + 1} is not an object.")

        text = str(question.get("question") or "").strip()
        options = question.get("options")
        correct_answer = question.get("correctAnswer")

        if not text or not isinstance(options, list) or len(options) != 4:
            raise RuntimeError(f"Question {index + 1} is missing text or four options.")

        try:
            correct_index = int(correct_answer)
        except (TypeError, ValueError) as error:
            raise RuntimeError(f"Question {index + 1} has invalid correctAnswer.") from error

        if correct_index < 0 or correct_index > 3:
            raise RuntimeError(f"Question {index + 1} correctAnswer is out of range.")

        difficulty = str(question.get("difficulty") or "medium").lower()
        if difficulty not in {"easy", "medium", "hard"}:
            difficulty = "medium"

        try:
            time_limit = int(question.get("timeLimit") or 60)
        except (TypeError, ValueError):
            time_limit = 60

        normalized.append(
            {
                "id": f"{seed}-q{index + 1}",
                "question": text,
                "options": [str(option).strip() for option in options],
                "correctAnswer": correct_index,
                "difficulty": difficulty,
                "explanation": "",
                "timeLimit": max(30, min(time_limit, 120)),
            }
        )

    if len(normalized) != count:
        raise RuntimeError(f"AI returned {len(normalized)} valid questions instead of {count}.")

    return normalized


def main() -> None:
    load_env_file()
    payload = json.loads(sys.stdin.read() or "{}")
    count = int(payload.get("count") or 10)
    seed = str(payload.get("uniquenessSeed") or f"{payload.get('mode', 'written')}-{int(time.time() * 1000)}")
    messages = build_prompt(payload)
    content = call_openrouter(messages, count)
    raw_questions = extract_json_array(content)
    questions = normalize_questions(raw_questions, count, seed)

    print(json.dumps({"questions": questions}, ensure_ascii=True))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(json.dumps({"error": str(error)}, ensure_ascii=True), file=sys.stderr)
        sys.exit(1)
