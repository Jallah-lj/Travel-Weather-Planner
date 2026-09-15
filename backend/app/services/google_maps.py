import math
import re
import httpx
from fastapi import HTTPException
from app.core.config import get_settings

class GoogleMapsProvider:
    def __init__(self): self.settings=get_settings()
    async def request(self,method,url,mask,**kwargs):
        if not self.settings.google_maps_server_key: raise HTTPException(503,'Google Maps Platform is not configured. Add a separate Maps server key; the Gemini key is not used.')
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                response=await client.request(method,url,headers={'X-Goog-Api-Key':self.settings.google_maps_server_key,'X-Goog-FieldMask':mask},**kwargs)
            if response.status_code in (401,403): raise HTTPException(503,'Google Maps access was denied. Check API enablement, key restrictions and billing.')
            if response.status_code==429: raise HTTPException(429,'Google Maps quota was reached. Try again later.')
            if response.status_code==404: raise HTTPException(422,'This place or route is unavailable. Search for the location again.')
            response.raise_for_status();return response.json()
        except (httpx.HTTPError,ValueError) as exc:
            raise HTTPException(502,'Google Maps could not complete this request. Your saved trip is unchanged.') from exc
    async def search(self,query,session,latitude,longitude):
        data=await self.request('POST','https://places.googleapis.com/v1/places:autocomplete','suggestions.placePrediction.placeId,suggestions.placePrediction.text',json={'input':query,'sessionToken':str(session),'languageCode':'en','locationBias':{'circle':{'center':{'latitude':latitude,'longitude':longitude},'radius':25000}}})
        results=[]
        for item in data.get('suggestions',[]):
            prediction=item.get('placePrediction',{}); place_id=prediction.get('placeId'); text=prediction.get('text',{}).get('text')
            if isinstance(place_id,str) and isinstance(text,str):results.append({'place_id':place_id,'text':text})
        return results
    async def details(self,place_id,session=None):
        params={'languageCode':'en'}
        if session:params['sessionToken']=str(session)
        data=await self.request('GET',f'https://places.googleapis.com/v1/places/{place_id}','id,displayName,formattedAddress,location,attributions',params=params)
        point=data.get('location',{})
        if not isinstance(data.get('id'),str) or not valid_point(point): raise HTTPException(422,'This place has no usable geographic location. Choose a physical place.')
        return {'place_id':data['id'],'name':data.get('displayName',{}).get('text','Place'),'address':data.get('formattedAddress',''),'latitude':point['latitude'],'longitude':point['longitude'],'attributions':[item for item in (data.get('attributions') or []) if isinstance(item,dict) and isinstance(item.get('provider'),str)]}
    async def route(self,items,mode):
        body={'origin':{'placeId':items[0]['location']['place_id']},'destination':{'placeId':items[-1]['location']['place_id']},'intermediates':[{'placeId':item['location']['place_id']} for item in items[1:-1]],'travelMode':mode,'computeAlternativeRoutes':False,'polylineQuality':'OVERVIEW','languageCode':'en','units':'METRIC'}
        if mode=='DRIVE':body['routingPreference']='TRAFFIC_UNAWARE'
        data=await self.request('POST','https://routes.googleapis.com/directions/v2:computeRoutes','routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline,routes.legs.duration,routes.legs.distanceMeters,routes.legs.startLocation,routes.legs.endLocation,routes.warnings',json=body)
        routes=data.get('routes',[])
        if not routes:raise HTTPException(422,'No route was found for these places and travel mode. No substitute route has been drawn.')
        route=routes[0]
        try:
            legs=[{'duration_seconds':seconds(leg.get('duration','0s')),'distance_meters':int(leg.get('distanceMeters',0)),'start':leg['startLocation']['latLng'],'end':leg['endLocation']['latLng']} for leg in route['legs']]
            if len(legs)!=len(items)-1 or not all(valid_point(leg['start']) and valid_point(leg['end']) for leg in legs):raise ValueError('Incomplete route')
            polyline=route['polyline']['encodedPolyline']
            if not isinstance(polyline,str) or not polyline or len(polyline)>300000:raise ValueError('Invalid polyline')
            return {'distance_meters':int(route.get('distanceMeters',0)),'duration_seconds':seconds(route['duration']),'polyline':polyline,'legs':legs,'warnings':[warning for warning in (route.get('warnings') or []) if isinstance(warning,str)]}
        except (KeyError,ValueError,TypeError) as exc:raise HTTPException(502,'Google returned an incomplete route. Try again; no substitute route is shown.') from exc

def valid_point(point):
    lat,lon=point.get('latitude'),point.get('longitude')
    return all(isinstance(value,(int,float)) and math.isfinite(value) for value in (lat,lon)) and -90<=lat<=90 and -180<=lon<=180

def seconds(value):
    if not isinstance(value,str) or not re.fullmatch(r'\d+(\.\d+)?s',value):raise ValueError('Invalid duration')
    result=float(value[:-1])
    if not math.isfinite(result):raise ValueError('Invalid duration')
    return result
