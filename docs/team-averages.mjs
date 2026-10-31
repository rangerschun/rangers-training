// Personal-use accounts keep their records, but never contribute to team benchmarks.
export const TEAM_AVERAGE_SCOPE='team-roster-20261031';
export const TEAM_AVERAGE_EXCLUSIONS=Object.freeze(['Marcus','Dominic','Demo']);
export function isTeamAveragePlayer(value){
 const name=typeof value==='string'?value:value?.player??value?.name??'';
 const first=String(name).trim().split(/\s+/)[0].toLowerCase();
 return !TEAM_AVERAGE_EXCLUSIONS.some(name=>name.toLowerCase()===first);
}
