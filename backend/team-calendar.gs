// Add to the copied backend only. The existing private feed URL stays outside GitHub.
function getPlayerTeamCalendar(request){
 const json=typeof request==='string';if(json){if(request.length>2000)throw Error('Invalid calendar request.');request=JSON.parse(request);}
 if(request?.coach===true)authenticateCoach_(request?.code);else authenticatePlayerSession_(request);
 const result={...fetchTeamSchedule_(),subscription_url:teamScheduleFeedUrl_()};return json?JSON.stringify(result):result;
}
// The older read method must enforce the same access rules.
function getTeamSchedule(request){return getPlayerTeamCalendar(request);}
