// DerpLib
var DerpLib = require('./derplib');

DerpLib.events.on("request",function(req){
	
	console.log('['+req.room.name+']['+req.user.name+'] '+req.message.text);
	
	req.write('Response');
	
	req.room.flag("some text");
	
	req.room.flagUser("user");
	
	req.room.delmsg("some text");
	
	req.room.delUser("user");
	
	req.room.clearUser("user");
	
	req.room.ban("user");
	
	req.room.unban("user");
	
	req.room.leave();
	
});

new DerpLib.PM({account: 'user', password: 'pass'});
new DerpLib.Room({room: 'room', account: 'user', password: 'pass'});

