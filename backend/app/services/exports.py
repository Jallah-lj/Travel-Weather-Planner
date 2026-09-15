from app.services.journey import day_destination
import hashlib
import html
import io
from datetime import datetime, timezone, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from fastapi import HTTPException
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, KeepTogether

FONTS = Path(__file__).resolve().parents[1] / 'assets' / 'fonts'
pdfmetrics.registerFont(TTFont('TravelSans', str(FONTS / 'DejaVuSans.ttf')))
pdfmetrics.registerFont(TTFont('TravelSansBold', str(FONTS / 'DejaVuSans-Bold.ttf')))

def stamp(): return datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')
def text(value): return html.escape(str(value), quote=True)
def esc_ics(value): return str(value).replace('\\', '\\\\').replace('\r\n', '\n').replace('\r', '\n').replace('\n', '\\n').replace(';', '\\;').replace(',', '\\,')
def fold(line):
    chunks = []; current = ''; count = 0
    for char in line:
        size = len(char.encode('utf-8'))
        if count + size > 75:
            chunks.append(current); current = ' '; count = 1
        current += char; count += size
    return '\r\n'.join(chunks + [current])
def uid(plan, item, kind): return hashlib.sha256(f"{plan['trip_id']}:{kind}:{item['id']}".encode()).hexdigest() + '@travel-weather'

def calendar(plan):
    zone = plan['destination']['timezone']
    try: tz = ZoneInfo(zone)
    except ZoneInfoNotFoundError: raise HTTPException(422, 'The destination timezone is unavailable for calendar export.')
    created = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Travel Weather//Trip Planner//EN', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:' + esc_ics(plan['title'])]
    for day in plan['itinerary']:
        destination = day_destination(plan, day['date'])
        zone = destination['timezone']
        try: tz = ZoneInfo(zone)
        except ZoneInfoNotFoundError: raise HTTPException(422, 'A stop timezone is unavailable for export.')
        for item in day['items']:
            local = datetime.fromisoformat(day['date'] + 'T' + item['time']).replace(tzinfo=tz)
            utc = local.astimezone(timezone.utc)
            if utc.astimezone(tz).replace(tzinfo=None) != local.replace(tzinfo=None): raise HTTPException(422, 'An activity falls in a daylight-saving time gap. Adjust its time before exporting.')
            lines += ['BEGIN:VEVENT', 'UID:' + uid(plan, item, 'activity'), 'DTSTAMP:' + created, 'SEQUENCE:' + str(plan['revision']), 'DTSTART:' + utc.strftime('%Y%m%dT%H%M%SZ'), 'SUMMARY:' + esc_ics(item['title']), 'LOCATION:' + esc_ics(destination['name'] + ', ' + destination['country']), 'DESCRIPTION:' + esc_ics(f"Destination local time: {day['date']} {item['time']} ({zone}). {'User-entered duration: '+str(item['duration_minutes'])+' minutes.' if item.get('duration_minutes') is not None else 'Start time only; no duration specified.'} Saved trip revision {plan['revision']}. Import is not a live subscription."), 'END:VEVENT']
            if item.get('duration_minutes') is not None:
                lines.insert(len(lines)-1, 'DTEND:'+(utc+timedelta(minutes=item['duration_minutes'])).strftime('%Y%m%dT%H%M%SZ'))
    for item in plan['packing']:
        lines += ['BEGIN:VTODO', 'UID:' + uid(plan, item, 'packing'), 'DTSTAMP:' + created, 'SEQUENCE:' + str(plan['revision']), 'SUMMARY:' + esc_ics('Pack: ' + item['name']), 'DESCRIPTION:' + esc_ics(f"Quantity: {item['quantity']}. {item['category']}"), 'STATUS:' + ('COMPLETED' if item['packed'] else 'NEEDS-ACTION'), 'PERCENT-COMPLETE:' + ('100' if item['packed'] else '0'), 'END:VTODO']
    return ('\r\n'.join(fold(line) for line in lines + ['END:VCALENDAR']) + '\r\n').encode('utf-8')

def pdf(plan):
    output = io.BytesIO()
    document = SimpleDocTemplate(output, pagesize=(210*mm,297*mm), leftMargin=19*mm, rightMargin=19*mm, topMargin=18*mm, bottomMargin=20*mm, title=plan['title'], author='Travel Weather')
    body = ParagraphStyle('Body', fontName='TravelSans', fontSize=10, leading=15, spaceAfter=7, textColor=colors.HexColor('#17221d'), alignment=TA_LEFT)
    title = ParagraphStyle('Title', parent=body, fontName='TravelSansBold', fontSize=22, leading=27, spaceAfter=15)
    heading = ParagraphStyle('Heading', parent=body, fontName='TravelSansBold', fontSize=14, leading=19, spaceBefore=15, spaceAfter=9)
    note = ParagraphStyle('Note', parent=body, fontSize=8, leading=12, textColor=colors.HexColor('#59665e'))
    story = [Paragraph('TRAVEL WEATHER', note), Paragraph(text(plan['title']), title), Paragraph(text(f"{plan['departure_date']} – {plan['return_date']} | {plan['destination']['country']}"), body), Paragraph(text(f"Activity times use each stop's timezone (listed below). Saved revision {plan['revision']} · Exported {stamp()}"), note), Paragraph('This is a saved snapshot, not a live forecast or booking. Keep this file private. Revoking a share link does not remove downloaded copies.', note), Paragraph('Itinerary', heading)]
    if len(plan.get('stops', [])) > 1:
        story.append(Paragraph('Journey stops', heading))
        for stop in plan['stops']:
            story.append(Paragraph(text(f"{stop['position']+1}. {stop['destination']['name']} · {stop['arrival_date']} – {stop['departure_date']} · {stop['destination']['timezone']}"), body))
    for day in plan['itinerary']:
        destination = day_destination(plan, day['date'])
        story.append(Paragraph(text(f"{day['date']} · {day['label']} · {destination['name']} ({destination['timezone']})"), heading))
        if not day['items']: story.append(Paragraph('No activities planned.', body))
        for item in day['items']: story.append(Paragraph(text(f"{item['time']}   {item['title']}" + (f" · {item['duration_minutes']} min" if item.get('duration_minutes') is not None else '')), body))
    story.append(Paragraph('Packing checklist', heading))
    if not plan['packing']: story.append(Paragraph('No packing items.', body))
    for item in plan['packing']: story.append(Paragraph(text(f"{'[x]' if item['packed'] else '[ ]'}  {item['name']} · Quantity {item['quantity']} · {item['category']}"), body))
    def footer(canvas, doc):
        canvas.setFont('TravelSans', 8); canvas.setFillColor(colors.HexColor('#59665e')); canvas.drawString(19*mm, 11*mm, 'Travel Weather · Saved trip snapshot'); canvas.drawRightString(191*mm,11*mm,str(doc.page))
    document.build(story, onFirstPage=footer, onLaterPages=footer)
    return output.getvalue()

def offline_html(plan):
    days = ''.join('<section><h3>' + text(day['date'] + ' · ' + day['label'] + ' · ' + day_destination(plan, day['date'])['name'] + ' (' + day_destination(plan, day['date'])['timezone'] + ')') + '</h3>' + (''.join('<div class="activity"><time>' + text(item['time']) + '</time><span>' + text(item['title']) + (f" <small>({item['duration_minutes']} min)</small>" if item.get('duration_minutes') is not None else '') + '</span></div>' for item in day['items']) or '<p>No activities planned.</p>') + '</section>' for day in plan['itinerary'])
    stops = ''.join('<section><strong>' + text(stop['destination']['name']) + '</strong><p>' + text(stop['arrival_date']+' – '+stop['departure_date']+' · '+stop['destination']['timezone']) + '</p></section>' for stop in plan.get('stops', []))
    packing = ''.join('<label class="pack"><input type="checkbox" ' + ('checked' if item['packed'] else '') + '><span>' + text(item['name']) + ' <small>× ' + text(item['quantity']) + ' · ' + text(item['category']) + '</small></span></label>' for item in plan['packing'])
    return ('''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>''' + text(plan['title']) + ''' — Offline trip</title><style>*{box-sizing:border-box}body{margin:0;background:#f5f2e9;color:#17221d;font:16px/1.6 system-ui,sans-serif}main{max-width:820px;margin:auto;padding:28px 20px 60px}h1{font-size:clamp(28px,6vw,44px);line-height:1.15}h2{margin-top:36px}h3{margin-top:0}section{background:#fff;border:1px solid #dce3dc;border-radius:16px;padding:20px;margin:14px 0}p,span,h1{overflow-wrap:anywhere}.eyebrow{color:#174b36;font-size:12px;letter-spacing:.13em;font-weight:700}.note{font-size:13px;color:#506052}.activity{display:flex;gap:20px;padding:12px 0;border-top:1px solid #edf0ec}.activity time{font-weight:700;flex-shrink:0}.pack{display:flex;align-items:center;gap:14px;min-height:52px;border-bottom:1px solid #edf0ec}.pack input{width:22px;height:22px;flex-shrink:0;accent-color:#174b36}.pack small{display:block;color:#506052}input:focus-visible{outline:3px solid #b47b22;outline-offset:3px}@media print{body{background:white}main{padding:0}section{break-inside:avoid}.note{color:#333}}</style></head><body><main><p class="eyebrow">TRAVEL WEATHER · OFFLINE COPY</p><h1>''' + text(plan['title']) + '</h1><p>' + text(plan['departure_date'] + ' – ' + plan['return_date'] + ' · ' + plan['destination']['country']) + '</p><p class="note">' + text(f"Saved revision {plan['revision']} · Downloaded {stamp()} · Activity times use each stop's timezone") + '''</p><section><strong>Available without internet</strong><p class="note">This file includes only your saved itinerary and packing checklist. It contains no map tiles, live weather, login tokens, or external assets. It will not update or sync. Checkbox changes are temporary and reset when reopened. Download a fresh copy after editing your trip.</p><p class="note">Keep this file private, especially on shared devices. Revoking a link cannot revoke a downloaded file. Use your browser’s Print command if you need a paper copy.</p></section><h2>Journey stops</h2>''' + stops + '<h2>Itinerary</h2>' + days + '<h2>Packing checklist</h2><section>' + (packing or '<p>No packing items.</p>') + '</section></main></body></html>').encode('utf-8')
