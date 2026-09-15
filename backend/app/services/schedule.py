import math

def minutes(time):
    hour, minute = map(int, time.split(':'))
    return hour*60+minute

def check_schedule(items, legs=None, buffer=10):
    issues=[]; segments=[]
    for item in items:
        if item.get('duration_minutes') is None: issues.append({'code':'missing_duration','activity_id':item['id'],'message':f"Enter a duration for {item['title']}."})
        if not item.get('location'): issues.append({'code':'missing_location','activity_id':item['id'],'message':f"Link a real place for {item['title']}."})
        if item.get('duration_minutes') is not None and minutes(item['time'])+item['duration_minutes']>1440:
            issues.append({'code':'overnight','activity_id':item['id'],'message':f"{item['title']} ends after midnight. Split or adjust the activity."})
    # Check all interval pairs, not just adjacent itinerary entries.
    for index,a in enumerate(items):
        for b in items[index+1:]:
            if a.get('duration_minutes') is not None and b.get('duration_minutes') is not None:
                start_a,start_b=minutes(a['time']),minutes(b['time'])
                if max(start_a,start_b)<min(start_a+a['duration_minutes'],start_b+b['duration_minutes']):
                    issues.append({'code':'overlap','activity_id':b['id'],'message':f"{a['title']} overlaps {b['title']}."})
    for index,(a,b) in enumerate(zip(items,items[1:])):
        travel=math.ceil(legs[index]['duration_seconds']/60) if legs is not None else None
        available=minutes(b['time'])-minutes(a['time'])-a['duration_minutes'] if a.get('duration_minutes') is not None else None
        if minutes(b['time'])<minutes(a['time']): issues.append({'code':'order','activity_id':b['id'],'message':f"{b['title']} starts earlier than the previous activity. Review the order."})
        shortage=max(0,travel+buffer-available) if travel is not None and available is not None else None
        segments.append({'from_id':a['id'],'to_id':b['id'],'available_minutes':available,'travel_minutes':travel,'buffer_minutes':buffer,'shortage_minutes':shortage})
        if shortage: issues.append({'code':'travel_gap','activity_id':b['id'],'message':f"Allow at least {shortage} more minutes before {b['title']} (including a {buffer}-minute buffer)."})
    if len(items)>1 and legs is None: issues.append({'code':'travel_unchecked','message':'Travel time has not been checked. Calculate a route after linking every activity location.'})
    if not items: issues.append({'code':'empty','message':'Add activities to check a schedule.'})
    conflicts=any(issue['code'] in ('overlap','overnight','order','travel_gap') for issue in issues)
    return {'status':'conflicts' if conflicts else 'incomplete' if issues else 'no_conflicts_detected','issues':issues,'segments':segments,'travel_checked':legs is not None,'note':'Estimates are planning guidance, not guarantees. Opening hours, flight/train schedules, queues and real-time traffic are not checked.'}
