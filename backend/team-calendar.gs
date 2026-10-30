// Add to the copied backend only. Feed addresses stay in private Script Properties.
function playerTeamCalendarFeed_(player,properties){
 const override=player?properties.getProperty('teamCalendarFeed:'+player):null;
 if(player==='Marcus'&&!override)throw Error('Marcus’s calendar needs to be configured by the coach.');
 const url=override||teamScheduleFeedUrl_();
 if(typeof url!=='string'||!/^https:\/\/ical-cdn\.teamsnap\.com\/team_schedule\/[A-Za-z0-9-]+\.ics$/.test(url))throw Error('The team calendar address is invalid.');return url;
}
function fetchPlayerTeamCalendar_(url){
 if(url===teamScheduleFeedUrl_())return fetchTeamSchedule_();
 const cache=CacheService.getScriptCache(),key='player-team-calendar:'+digest_(url),saved=cache.get(key);if(saved)return JSON.parse(saved);
 const response=UrlFetchApp.fetch(url,{method:'get',followRedirects:false,muteHttpExceptions:true,headers:{Accept:'text/calendar'}}),text=response.getContentText('UTF-8');
 if(response.getResponseCode()!==200||text.length>2000000||!text.trimStart().startsWith('BEGIN:VCALENDAR')||!text.includes('END:VCALENDAR'))throw Error('TeamSnap schedule is unavailable.');
 const result={ical_text:text,fetched_at:new Date().toISOString(),source:'TeamSnap',stale:false},json=JSON.stringify(result);if(json.length<90000)cache.put(key,json,60);return result;
}
function getPlayerTeamCalendar(request){
 const json=typeof request==='string';if(json){if(request.length>2000)throw Error('Invalid calendar request.');request=JSON.parse(request);}
 const properties=PropertiesService.getScriptProperties();let player;
 if(request?.coach===true){authenticateCoach_(request?.code);player=request?.player||'';if(player&&!JSON.parse(properties.getProperty('players')||'[]').includes(player))throw Error('Choose a roster player.');}
 else player=authenticatePlayerSession_(request);
 const url=playerTeamCalendarFeed_(player,properties),result={...fetchPlayerTeamCalendar_(url),subscription_url:url,calendar_player:player||null};return json?JSON.stringify(result):result;
}
// The older read method enforces the same access rules.
function getTeamSchedule(request){return getPlayerTeamCalendar(request);}
