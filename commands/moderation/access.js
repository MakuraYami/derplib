
// Derplib command file

var MM 		   = module.parent,
	commands = MM.plugin.load('commands'),
	db		 = MM.plugin.load('database');
 
commands.register({
	key: 'access',
	access: 10,
	run: function(req){
		if(req.message.args.length > 1){
			var user = db.get('users.'+req.message.args[0]);
			if(!user){
				req.write("Can't find that user");
			}else if(!/^\d+$/.test(req.message.args[1])){
				req.write("Invalid access level");
			}else{
				user.access = parseInt(req.message.args[1]);
				req.write("Done");
			}
		}else{
			req.write('Write /access [name] [level]');
		}
	}
});