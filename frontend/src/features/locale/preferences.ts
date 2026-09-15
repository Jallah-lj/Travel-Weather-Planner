import { useSyncExternalStore } from 'react'
import languageCodes from './languages.json'

export type LanguagePreferences = { aiLanguage: string; formatLocale: string; hourCycle: 'h12' | 'h23' }
export const regionalFormats = [
  ['en-RW','English · Rwanda'], ['en-GB','English · United Kingdom'], ['en-US','English · United States'],
  ['fr-RW','French · Rwanda'], ['fr-FR','French · France'], ['sw-KE','Swahili · Kenya'], ['de-DE','German · Germany'],
  ['es-ES','Spanish · Spain'], ['pt-BR','Portuguese · Brazil'], ['ar-EG','Arabic · Egypt'], ['hi-IN','Hindi · India'],
  ['ja-JP','Japanese · Japan'], ['zh-CN','Chinese · China'],
]
export const defaultLanguagePreferences: LanguagePreferences = { aiLanguage:'en',formatLocale:'en-RW',hourCycle:'h23' }
const key='travel-weather:language-region'
const eventName='travel-weather:language-region-changed'
const display=new Intl.DisplayNames(['en'],{type:'language'})
export const languages=languageCodes.map(code=>{let native=code;try{native=new Intl.DisplayNames([code],{type:'language'}).of(code)||code}catch{}return {code,label:display.of(code)||code,native}}).sort((a,b)=>a.label.localeCompare(b.label))
export function languageName(code:string){return display.of(code)||code}
function snapshot(){try{return localStorage.getItem(key)||''}catch{return ''}}
function parse(raw:string):LanguagePreferences {
  try {const value=JSON.parse(raw);return {aiLanguage:languageCodes.includes(value.aiLanguage)?value.aiLanguage:'en',formatLocale:regionalFormats.some(([code])=>code===value.formatLocale)?value.formatLocale:'en-RW',hourCycle:value.hourCycle==='h12'?'h12':'h23'}} catch{return defaultLanguagePreferences}
}
export function readLanguagePreferences(){return parse(snapshot())}
export function saveLanguagePreferences(value:LanguagePreferences){localStorage.setItem(key,JSON.stringify(value));window.dispatchEvent(new Event(eventName))}
function subscribe(listener:()=>void){window.addEventListener('storage',listener);window.addEventListener(eventName,listener);return()=>{window.removeEventListener('storage',listener);window.removeEventListener(eventName,listener)}}
export function useLanguagePreferences(){const raw=useSyncExternalStore(subscribe,snapshot,()=> '');return parse(raw)}
export function formatTripDate(value:string,locale=readLanguagePreferences().formatLocale){return new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeZone:'UTC'}).format(new Date(`${value}T12:00:00Z`))}
export function formatLocalDateTime(value:string){const prefs=readLanguagePreferences();return new Intl.DateTimeFormat(prefs.formatLocale,{dateStyle:'medium',timeStyle:'short',hourCycle:prefs.hourCycle}).format(new Date(value))}
