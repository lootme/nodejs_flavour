module.exports = (data, onLogicProcessed) => {

	var helper = cms.useModule('helper');
	
	var user = auth.get();
	
	data.instanceManagmentSettings = {
		name : 'project',
		title : 'Projects',
		fields_settings : {
			UserId : {
				hide : true
			}
		}
	};

	onLogicProcessed(data);
}