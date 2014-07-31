
// Derplib command file

var MM 		    = module.parent,
	DerpLib     = MM.parent,
	commands    = MM.plugin.load('commands'),
	_		    = require('underscore');

commands.register({
	key: 'clear',
	access: 10,
	run: function(req){
		if(req.message.args[0])
			req.room.clearUser(req.message.args[0]);
		else
			req.write("Give a name");
	}
});

commands.register({
	key: 'clearall',
	access: 10,
	run: function(req){
		if(req.room._isAdmin)
			req.room.clearAll();
		else if(req.room._isModerator)
			req.room.modClearAll();
		else
			req.write("I'm not a moderator.");
	}
});

commands.register({
	key: 'del',
	access: 10,
	run: function(req){
		if(!req.room._isModerator){
			req.write("I'm not a moderator.");
			return;
		}
		if( req.message.args.length == 0 ){
			req.write("Please write what you want to delete");
		} else if( req.message.args.length == 1 ){
			// One argument
			if(/[0-9]*/g.test(req.message.args[0])){
				req.room.delLast(parseInt(req.message.args[0]) + 1);
			} else {
				req.room.clearUser(req.message.args[0]);
			}
		} else {
			if(/[0-9]*/g.test(req.message.args[1])){
				req.room.delLastUser(req.message.args[0], req.message.args[1]);
			}
		}
	}
});