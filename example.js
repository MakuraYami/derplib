// DerpLib
var DerpLib = require('./derplib');

DerpLib.events.on("request",function(req){
	
	console.log('['+req.room.name+']['+req.user.name+'] '+req.message.text);
	
	req.write('Response');
	
});

new DerpLib.PM({account: 'user', password: 'pass'});
new DerpLib.Room({room: 'room', account: 'user', password: 'pass'});

