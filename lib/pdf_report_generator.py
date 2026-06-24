import io
import json
import re
import sys
from datetime import datetime
from html import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


PAGE_WIDTH, PAGE_HEIGHT = letter

PALETTE = {
    "navy": colors.HexColor("#06101d"),
    "ink": colors.HexColor("#17233b"),
    "muted": colors.HexColor("#576179"),
    "line": colors.HexColor("#d7dfec"),
    "panel": colors.HexColor("#f6f9ff"),
    "panel_alt": colors.HexColor("#edf4ff"),
    "cyan": colors.HexColor("#17b8ff"),
    "blue": colors.HexColor("#2f61ff"),
    "purple": colors.HexColor("#7248ff"),
    "green": colors.HexColor("#14a05a"),
    "gold": colors.HexColor("#d89920"),
    "rose": colors.HexColor("#d64b67"),
    "white": colors.white,
}


def sanitize_text(value):
    return re.sub(r"\s+", " ", str(value or "")).strip()


def sanitize_multiline(value):
    text = str(value or "").replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[^\x09\x0A\x0D\x20-\x7E]", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def parse_timestamp(value):
    if not value:
      return ""
    text = str(value).strip()
    try:
        normalized = text.replace("Z", "+00:00")
        return datetime.fromisoformat(normalized).strftime("%d %b %Y, %I:%M %p")
    except ValueError:
        return text


def get_latest_sessions_by_type(sessions):
    latest = {}
    for session in sessions:
        key = sanitize_text(session.get("testType", "")).lower()
        if key:
            latest[key] = session
    return latest


def calculate_accuracy(session):
    results = session.get("results") or []
    if not results:
        return 0
    correct = sum(1 for result in results if result.get("isCorrect"))
    return round((correct / len(results)) * 100)


def calculate_game_score(session):
    game_scores = (session or {}).get("gameScores") or {}
    score_total = 0
    for item in game_scores.values():
        if item:
            score_total += int(item.get("score") or 0)
    return max(0, min(100, round(score_total)))


def calculate_average_reaction(session):
    if not session:
        return 0
    if session.get("averageReactionTime") is not None:
        return int(round(float(session.get("averageReactionTime") or 0)))

    results = session.get("results") or []
    reaction_times = [float(item.get("reactionTime") or 0) for item in results if item.get("reactionTime") is not None]
    if reaction_times:
        return int(round(sum(reaction_times) / len(reaction_times)))

    game_scores = (session.get("gameScores") or {}).values()
    game_reactions = [float(item.get("reactionTime") or 0) for item in game_scores if item and item.get("reactionTime") is not None]
    if game_reactions:
        return int(round(sum(game_reactions) / len(game_reactions)))
    return 0


def scholarship_summary(payload):
    provided = payload.get("scholarship") or {}
    sessions = payload.get("sessions") or []
    latest = get_latest_sessions_by_type(sessions)
    text_score = int(provided.get("textScore") or calculate_accuracy(latest.get("text") or {}))
    voice_score = int(provided.get("voiceScore") or calculate_accuracy(latest.get("voice") or {}))
    game_score = int(provided.get("gameScore") or calculate_game_score(latest.get("game") or {}))
    total = int(provided.get("totalPercentage") or round((text_score + voice_score + game_score) / 3))
    eligible = bool(provided["eligible"]) if "eligible" in provided else total > 30
    return {
        "textScore": text_score,
        "voiceScore": voice_score,
        "gameScore": game_score,
        "totalPercentage": total,
        "eligible": eligible,
    }


def convert_inline_markdown(text):
    safe = escape(text)
    safe = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", safe)
    safe = re.sub(r"(?<!\*)\*(?!\s)(.+?)(?<!\s)\*(?!\*)", r"<i>\1</i>", safe)
    safe = safe.replace("\t", "    ")
    return safe


def markdown_to_flowables(text, styles):
    clean = sanitize_multiline(text)
    if not clean:
        return [Paragraph("No content available yet.", styles["Body"])]

    flowables = []
    lines = clean.split("\n")
    buffer = []

    def flush_buffer():
        if not buffer:
            return
        paragraph_text = " ".join(buffer).strip()
        if paragraph_text:
            flowables.append(Paragraph(convert_inline_markdown(paragraph_text), styles["Body"]))
            flowables.append(Spacer(1, 8))
        buffer.clear()

    for raw_line in lines:
        line = raw_line.strip()
        if not line:
            flush_buffer()
            continue

        if re.fullmatch(r"[-| ]{3,}", line):
            continue

        if line.startswith("### "):
            flush_buffer()
            flowables.append(Paragraph(convert_inline_markdown(line[4:]), styles["MinorHeading"]))
            flowables.append(Spacer(1, 6))
            continue

        if line.startswith("## "):
            flush_buffer()
            flowables.append(Paragraph(convert_inline_markdown(line[3:]), styles["SectionHeading"]))
            flowables.append(Spacer(1, 8))
            continue

        if line.startswith("# "):
            flush_buffer()
            flowables.append(Paragraph(convert_inline_markdown(line[2:]), styles["SectionHeading"]))
            flowables.append(Spacer(1, 8))
            continue

        if line.startswith(("- ", "* ")):
            flush_buffer()
            item = line[2:].strip()
            flowables.append(Paragraph(f'<font color="#17b8ff">&#8226;</font> {convert_inline_markdown(item)}', styles["Bullet"]))
            flowables.append(Spacer(1, 4))
            continue

        if re.match(r"^\d+\.\s+", line):
            flush_buffer()
            flowables.append(Paragraph(convert_inline_markdown(line), styles["Bullet"]))
            flowables.append(Spacer(1, 4))
            continue

        if "|" in line and line.count("|") >= 2:
            flush_buffer()
            parts = [sanitize_text(part) for part in line.strip("|").split("|")]
            parts = [part for part in parts if part]
            if parts:
                flowables.append(Paragraph(convert_inline_markdown(" | ".join(parts)), styles["CodeLine"]))
                flowables.append(Spacer(1, 4))
            continue

        buffer.append(line)

    flush_buffer()

    if flowables and isinstance(flowables[-1], Spacer):
        flowables.pop()
    return flowables


def build_styles():
    sample = getSampleStyleSheet()
    styles = {
        "Meta": ParagraphStyle(
            "Meta",
            parent=sample["Normal"],
            fontName="Helvetica",
            fontSize=10.5,
            leading=14,
            textColor=PALETTE["muted"],
            alignment=TA_CENTER,
            spaceAfter=4,
        ),
        "SectionHeading": ParagraphStyle(
            "SectionHeading",
            parent=sample["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=18,
            leading=22,
            textColor=PALETTE["ink"],
            spaceAfter=10,
            spaceBefore=2,
        ),
        "MinorHeading": ParagraphStyle(
            "MinorHeading",
            parent=sample["Heading3"],
            fontName="Helvetica-Bold",
            fontSize=13,
            leading=16,
            textColor=PALETTE["ink"],
            spaceAfter=6,
        ),
        "Body": ParagraphStyle(
            "Body",
            parent=sample["BodyText"],
            fontName="Helvetica",
            fontSize=11.2,
            leading=17,
            textColor=PALETTE["ink"],
            alignment=TA_LEFT,
            spaceAfter=0,
        ),
        "Bullet": ParagraphStyle(
            "Bullet",
            parent=sample["BodyText"],
            fontName="Helvetica",
            fontSize=11,
            leading=16,
            leftIndent=10,
            textColor=PALETTE["ink"],
        ),
        "CodeLine": ParagraphStyle(
            "CodeLine",
            parent=sample["Code"],
            fontName="Helvetica",
            fontSize=10.2,
            leading=14,
            textColor=PALETTE["ink"],
            backColor=colors.HexColor("#eef3fb"),
            leftIndent=8,
            rightIndent=8,
            borderPadding=6,
        ),
        "TableLabel": ParagraphStyle(
            "TableLabel",
            parent=sample["Normal"],
            fontName="Helvetica-Bold",
            fontSize=9.5,
            leading=11,
            textColor=PALETTE["muted"],
        ),
        "TableValue": ParagraphStyle(
            "TableValue",
            parent=sample["Normal"],
            fontName="Helvetica-Bold",
            fontSize=18,
            leading=21,
            textColor=PALETTE["ink"],
        ),
        "TableValueSmall": ParagraphStyle(
            "TableValueSmall",
            parent=sample["Normal"],
            fontName="Helvetica-Bold",
            fontSize=11.5,
            leading=14,
            textColor=PALETTE["ink"],
        ),
        "Footer": ParagraphStyle(
            "Footer",
            parent=sample["Normal"],
            fontName="Helvetica",
            fontSize=9,
            leading=11,
            alignment=TA_CENTER,
            textColor=PALETTE["muted"],
        ),
    }
    return styles


def metric_cards(payload, styles):
    entries = [
        ("Student", sanitize_text(payload.get("studentName")) or "Student", PALETTE["blue"]),
        ("Class", sanitize_text(payload.get("studentClass")) or "N/A", PALETTE["purple"]),
        ("Estimated IQ", str(payload.get("iqScore") or "N/A"), PALETTE["cyan"]),
        ("Current Score", f'{int(payload.get("score") or 0)}%', PALETTE["green"]),
        ("Avg. Reaction", f'{int(payload.get("avgReactionTime") or 0)} ms', PALETTE["gold"]),
        ("Attention", f'{int(payload.get("attentionScore") or 0)}%', PALETTE["purple"]),
    ]
    rows = []
    current = []
    for label, value, accent in entries:
        cell = Table(
            [[Paragraph(escape(label), styles["TableLabel"])], [Paragraph(escape(value), styles["TableValue"])]],
            colWidths=[1.72 * inch],
        )
        cell.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), colors.white),
                    ("BOX", (0, 0), (-1, -1), 1, PALETTE["line"]),
                    ("LINEBEFORE", (0, 0), (0, -1), 5, accent),
                    ("LEFTPADDING", (0, 0), (-1, -1), 16),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 14),
                    ("TOPPADDING", (0, 0), (-1, -1), 12),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
                    ("BACKGROUND", (0, 0), (-1, -1), colors.white),
                ]
            )
        )
        current.append(cell)
        if len(current) == 3:
            rows.append(current)
            current = []
    if current:
        while len(current) < 3:
            current.append("")
        rows.append(current)

    table = Table(rows, colWidths=[2.02 * inch, 2.02 * inch, 2.02 * inch], hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    return table


def scholarship_banner(summary, styles):
    background = PALETTE["green"] if summary["eligible"] else PALETTE["rose"]
    title = "Scholarship Eligible" if summary["eligible"] else "Scholarship Not Eligible Yet"
    subtitle = f'Total Score {summary["totalPercentage"]}%'
    table = Table(
        [[
            Paragraph(
                f'<font color="white"><b>{escape(title)}</b></font><br/><font color="white">{escape(subtitle)}</font>',
                ParagraphStyle(
                    "Banner",
                    parent=styles["Body"],
                    fontName="Helvetica-Bold",
                    fontSize=18,
                    leading=22,
                    textColor=colors.white,
                ),
            )
        ]],
        colWidths=[6.28 * inch],
    )
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), background),
                ("BOX", (0, 0), (-1, -1), 0, background),
                ("LEFTPADDING", (0, 0), (-1, -1), 18),
                ("RIGHTPADDING", (0, 0), (-1, -1), 18),
                ("TOPPADDING", (0, 0), (-1, -1), 14),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
            ]
        )
    )
    return table


def score_breakdown_table(summary, styles):
    rows = [
        [
            Paragraph("<b>Assessment</b>", styles["TableValueSmall"]),
            Paragraph("<b>Score</b>", styles["TableValueSmall"]),
            Paragraph("<b>Status</b>", styles["TableValueSmall"]),
        ],
        ["Text-Based Test", f'{summary["textScore"]}%', "Completed"],
        ["Voice-Based Test", f'{summary["voiceScore"]}%', "Completed"],
        ["Game-Based Test", f'{summary["gameScore"]}%', "Completed"],
        ["Combined Scholarship Score", f'{summary["totalPercentage"]}%', "Eligible" if summary["eligible"] else "Not Eligible"],
    ]

    parsed_rows = []
    for row in rows:
        parsed = []
        for item in row:
            if isinstance(item, Paragraph):
                parsed.append(item)
            else:
                parsed.append(Paragraph(escape(str(item)), styles["Body"]))
        parsed_rows.append(parsed)

    table = Table(parsed_rows, colWidths=[3.15 * inch, 1.1 * inch, 2.03 * inch], hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), PALETTE["panel_alt"]),
                ("TEXTCOLOR", (0, 0), (-1, 0), PALETTE["ink"]),
                ("GRID", (0, 0), (-1, -1), 0.75, PALETTE["line"]),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, PALETTE["panel"]]),
                ("LEFTPADDING", (0, 0), (-1, -1), 12),
                ("RIGHTPADDING", (0, 0), (-1, -1), 12),
                ("TOPPADDING", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    return table


def completed_sessions_table(sessions, styles):
    rows = [[
        Paragraph("<b>Test Type</b>", styles["TableValueSmall"]),
        Paragraph("<b>Hits</b>", styles["TableValueSmall"]),
        Paragraph("<b>Avg. ms</b>", styles["TableValueSmall"]),
        Paragraph("<b>Game</b>", styles["TableValueSmall"]),
        Paragraph("<b>Date</b>", styles["TableValueSmall"]),
    ]]

    if not sessions:
        rows.append([
            Paragraph("No completed sessions found.", styles["Body"]),
            "",
            "",
            "",
            "",
        ])
    else:
        for session in sessions:
            results = session.get("results") or []
            correct = sum(1 for item in results if item.get("isCorrect"))
            game_score = sum(int((entry or {}).get("score") or 0) for entry in (session.get("gameScores") or {}).values())
            rows.append(
                [
                    Paragraph(escape(sanitize_text(session.get("testType")).title() or "Test"), styles["Body"]),
                    Paragraph(escape(f"{correct}/{len(results)}"), styles["Body"]),
                    Paragraph(escape(f"{calculate_average_reaction(session)} ms"), styles["Body"]),
                    Paragraph(escape(str(game_score)), styles["Body"]),
                    Paragraph(escape(parse_timestamp(session.get("timestamp")) or "-"), styles["Body"]),
                ]
            )

    table = Table(rows, colWidths=[1.1 * inch, 1.0 * inch, 1.1 * inch, 0.95 * inch, 2.13 * inch], hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), PALETTE["panel_alt"]),
                ("GRID", (0, 0), (-1, -1), 0.75, PALETTE["line"]),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, PALETTE["panel"]]),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 9),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    return table


def section_block(title, content_flowables, styles):
    title_para = Paragraph(escape(title), styles["SectionHeading"])
    inner = [[title_para]]
    for item in content_flowables:
        inner.append([item])

    table = Table(inner, colWidths=[6.28 * inch], hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.white),
                ("BOX", (0, 0), (-1, -1), 1, PALETTE["line"]),
                ("BACKGROUND", (0, 0), (-1, 0), PALETTE["panel_alt"]),
                ("LINEBELOW", (0, 0), (-1, 0), 1, PALETTE["line"]),
                ("LEFTPADDING", (0, 0), (-1, -1), 16),
                ("RIGHTPADDING", (0, 0), (-1, -1), 16),
                ("TOPPADDING", (0, 0), (-1, -1), 14),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
            ]
        )
    )
    return table


def build_story(payload):
    styles = build_styles()
    summary = scholarship_summary(payload)
    story = []

    story.append(Paragraph(f'Generated {escape(datetime.now().strftime("%d %b %Y, %I:%M %p"))} | AI-powered cognitive assessment summary', styles["Meta"]))
    story.append(Spacer(1, 18))
    story.append(metric_cards(payload, styles))
    story.append(Spacer(1, 10))
    story.append(scholarship_banner(summary, styles))
    story.append(Spacer(1, 12))
    story.append(
        Paragraph(
            convert_inline_markdown(
                f'Total percentage is calculated as the average of Text ({summary["textScore"]}%), Voice ({summary["voiceScore"]}%), and Game ({summary["gameScore"]}%). Scholarship eligibility requires a total score greater than 30%.'
            ),
            styles["Body"],
        )
    )
    story.append(Spacer(1, 16))

    analysis_flowables = markdown_to_flowables(payload.get("analysis") or "No AI analysis is available yet.", styles)
    story.append(section_block("AI Analysis Summary", analysis_flowables, styles))
    story.append(Spacer(1, 16))

    score_flowables = [score_breakdown_table(summary, styles)]
    story.append(section_block("Test Score Breakdown", score_flowables, styles))
    story.append(Spacer(1, 16))

    sessions_flowables = [completed_sessions_table(payload.get("sessions") or [], styles)]
    story.append(section_block("Completed Sessions", sessions_flowables, styles))
    story.append(Spacer(1, 16))

    report_flowables = markdown_to_flowables(
        payload.get("comprehensiveReport") or "Generate the comprehensive report in the app before downloading to include it here.",
        styles,
    )
    story.append(section_block("Comprehensive Report", report_flowables, styles))
    return story


def draw_header_footer(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(PALETTE["navy"])
    canvas.rect(0, PAGE_HEIGHT - 96, PAGE_WIDTH, 96, stroke=0, fill=1)
    canvas.setFillColor(PALETTE["cyan"])
    canvas.rect(0, PAGE_HEIGHT - 100, PAGE_WIDTH, 4, stroke=0, fill=1)

    canvas.setFillColor(PALETTE["white"])
    canvas.setFont("Helvetica-Bold", 24)
    canvas.drawString(doc.leftMargin, PAGE_HEIGHT - 46, "DexTest")
    canvas.setFont("Helvetica", 10.5)
    canvas.setFillColor(colors.HexColor("#bcd2ff"))
    canvas.drawString(doc.leftMargin, PAGE_HEIGHT - 64, "Premium Cognitive Assessment")

    canvas.setFillColor(colors.HexColor("#e9eef9"))
    canvas.rect(0, 0, PAGE_WIDTH, 32, stroke=0, fill=1)
    canvas.setFillColor(PALETTE["muted"])
    canvas.setFont("Helvetica", 9)
    canvas.drawCentredString(PAGE_WIDTH / 2, 11, f"Page {doc.page}")
    canvas.restoreState()


def create_pdf(payload):
    buffer = io.BytesIO()
    doc = BaseDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=0.68 * inch,
        rightMargin=0.68 * inch,
        topMargin=1.55 * inch,
        bottomMargin=0.65 * inch,
        title="DexTest Assessment Report",
        author="DexTest",
    )

    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="normal")
    template = PageTemplate(id="DexTestReport", frames=[frame], onPage=draw_header_footer)
    doc.addPageTemplates([template])

    story = build_story(payload)
    doc.build(story)
    return buffer.getvalue()


def main():
    payload = json.load(sys.stdin)
    pdf_bytes = create_pdf(payload)
    sys.stdout.buffer.write(pdf_bytes)


if __name__ == "__main__":
    main()
