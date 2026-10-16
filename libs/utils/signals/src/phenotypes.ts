// Resistance flags that are alarming on a single find, keyed by the flag code
// a laboratory writes on the isolate (lower case). A public classification,
// not hospital data, in the same spirit as the WHO AWaRe table (@aei/empiric aware.ts):
//
//   cpe  carbapenemase-producing Enterobacterales
//   vre  vancomycin-resistant enterococci
//
// Both are rare in Finland and each find leads to contact precautions and
// screening of contacts (THL, communicable-disease register: CPE and VRE are
// laboratory-notifiable; THL guidance on multidrug-resistant microbes). MRSA
// and ESBL are notifiable too but common enough that a single find is not
// news; AEI raises them when they are new on a unit, surge or cluster.
//
// The engine knows nothing else about flags: an unknown flag is still
// counted, surged and clustered like any other, and a feed can pass its own
// list (SignalOptions.sentinelPhenotypes).

export const ALWAYS_ALERT_FLAGS: readonly string[] = ["cpe", "vre"];
