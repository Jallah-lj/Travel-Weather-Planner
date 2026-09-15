export function GoogleAttribution({ attributions = [] }: { attributions?: { provider: string; providerUri?: string }[] }) {
  return <div className="google-attribution"><img className="google-logo-light" src="/google-maps-attribution-light.svg" alt="Google Maps"/><img className="google-logo-dark" src="/google-maps-attribution-dark.svg" alt="Google Maps"/>{attributions.map((item,index)=><span key={index}>{item.providerUri?.startsWith('https://')?<a href={item.providerUri} target="_blank" rel="noopener noreferrer">{item.provider}</a>:item.provider}</span>)}</div>
}
