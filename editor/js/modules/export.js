var ExportModule = {

	//list of files to be included when exporting the player
	player_files: [
		"player.html",
		"js/extra/gl-matrix-min.js",
		"js/extra/litegl.js",
		"js/extra/litegraph.js",
		"js/extra/Canvas2DtoWebGL.js",
		"js/extra/litescene.js",
		"data/shaders.xml"
	],

	//allows to create new exporters easily for propietary formats
	exporters: {},

	init: function()
	{
		/*LiteGUI.menubar.add("Project/Export", { callback: function() {
			ExportModule.showDialog();
		}});

		LiteGUI.requireScript("js/extra/jszip.min.js");*/
	},

	registerExporter: function( exporter )
	{
		if(!exporter.name)
			throw("Exporter name missing");
		this.exporters[ exporter.name ] = exporter;
	},

	showDialog: function()
	{
		var that = this;
		var dialog = new LiteGUI.Dialog( { title: "Export", close: true, width: 800, height: 400, scroll: false, draggable: true } );

		var area = new LiteGUI.Area({width:"100%",height:"100%"});
		area.split("horizontal",["50%",null]);
		dialog.add(area);

		var inspector_left = new LiteGUI.Inspector( { scroll: true, resizable: true, full: true } );
		area.getSection(0).add( inspector_left );

		var inspector_right = new LiteGUI.Inspector( { scroll: true, name_width: 150, resizable: true, full: true } );
		area.getSection(1).add( inspector_right );

		//FILE SELECTION
		var unselected_as_links = true;
		var resources_list = null;

		inspector_left.on_refresh = function()
		{
			inspector_left.addTitle("Exported Files");
			var resources = LS.GlobalScene.getResources( {}, true, true, true );
			resources_list = inspector_left.addList( null, resources, { multiselection: true, height: 300 });
			for(var j = 0; j < resources.length; ++j)
				resources_list.selectIndex(j,true);
			inspector_left.addCheckbox("Set unselected as links",unselected_as_links,{ name_width: 200, callback: function(v){ unselected_as_links = v; }} );
			inspector_left.addButtons("Select",["All","None","Scripts"], function(v){
				if(v == "All")
				{
					for(var j = 0; j < resources.length; ++j)
						resources_list.selectIndex(j,true);
				}
				else if(v == "None")
				{
					for(var j = 0; j < resources.length; ++j)
						resources_list.deselectIndex(j);
				}
				else if(v == "Scripts")
				{
					resources_list.selectByFilter(function(v,item,selected){
						if( LS.RM.getExtension( item.dataset["name"] ) == "js" )
							return true;
					});
				}
			});
		}

		//EXPORT MODES
		var modes = [];
		for(var i in this.exporters)
			modes.push(i);
		var mode = modes[0];
		var exporter = this.exporters[ mode ];

		inspector_right.on_refresh = function()
		{
			var inspector = inspector_right;
			inspector.clear();

			inspector.addCombo("Export mode", mode, { values: modes, callback: function(v){
				mode = v;
				exporter = that.exporters[ mode ];
				inspector.refresh();
			}});
			inspector.addSeparator();
			inspector.startContainer("",{ height: 300 });
			if(exporter.inspect)
				exporter.inspect( inspector );
			inspector.endContainer();
			inspector.addSeparator();
			inspector.addButton(null,"Export",{ callback: function(){

				if(exporter.export)
				{
					dialog.close();
					var alert = LiteGUI.alert("Exporting...");
					var info = {};
					info.resources = resources_list.getSelected();
					exporter.export( info, function(){
						alert.close();
					});
				}
			}});
		}

		inspector_left.refresh();
		inspector_right.refresh();
		dialog.show();
	},

	exportToOBJ: function( to_memory )
	{
		var meshes = [];
		for(var i = 0; i < LS.Renderer._visible_instances.length; i++)
		{
			var ri = LS.Renderer._visible_instances[i];
			meshes.push( { mesh: ri.mesh, vertices_matrix: ri.matrix, normals_matrix: ri.normal_matrix } );
		}
		if(!meshes.length)
			return;
		var final_mesh = GL.Mesh.mergeMeshes( meshes );
		LS.RM.registerResource( "export.obj", final_mesh );
		var data = final_mesh.encode("obj");

		if(!to_memory)
			LiteGUI.downloadFile("export.OBJ", data );
		else
			LS.RM.processResource("export.obj", data );
	},

	exportToZIP: function( include_player, strip_unitnames )
	{
		if(!window.JSZip)
		{
			LiteGUI.alert("JSZIP.js not found.");
			return;
		}

		//get all resource and its names
		var resources = [];
		var resource_names = LS.GlobalScene.getResources( null, true, true, true );
		for(var i in resource_names)
		{
			var res = LS.RM.getResource( resource_names[i] );
			if(res)
				resources.push(res);
		}

		var zip = new JSZip();

		//rename resources in case we need it
		var renamed_resources = {};
		if( strip_unitnames )
		{
			var new_resource_names = [];
			for(var i in resource_names)
			{
				var old_name = resource_names[i];
				var folder = LS.RM.getFolder( old_name );
				var filename = LS.RM.getFilename( old_name );
				var t = LS.RM.cleanFullpath( folder ).split("/");
				t.shift(); //remove unit name
				var new_name = t.join("/") + "/" + filename;
				renamed_resources[ old_name ] = new_name;
				LS.RM.renameResource( old_name, new_name );
				new_resource_names.push( new_name );
			}
			resource_names = new_resource_names;
		}

		//scene info
		var scene_json = LS.GlobalScene.serialize();
		zip.file("scene.json", JSON.stringify( scene_json ) );

		//resources
		var res_data = LS.RM.getResourcesData( resource_names );
		for(var filename in res_data)
		{
			zip.file( filename, res_data[ filename ] );
		}

		//restore stuff: this is done in case we messed up some global resource filename (like textures in shared materials)
		if( strip_unitnames )
		{
			for(var i in resource_names)
			{
				var old_name = resource_names[i];
				var new_name = renamed_resources[old_name];
				LS.RM.renameResource( new_name, old_name ); //back to normal
				var res = LS.RM.getResource( old_name );
				old_name._modified = false; //to leave it as it was (assuming it wasnt modified)
			}
		}

		var filename = "scene.zip";

		if( include_player )
			this.loadPlayerFiles( zip, inner_ready );
		else
			inner_ready();

		function inner_ready()
		{
			//create ZIP file
			zip.generateAsync({type:"blob"}).then(function(content) {
				LiteGUI.downloadFile( filename, content );
			});
		}
	},

	exportToWBIN: function( resources )
	{
		var pack = LS.GlobalScene.toPack( "scene", resources );
		if(pack)
			LiteGUI.downloadFile( "scene.PACK.wbin", pack.bindata );
	},

	loadPlayerFiles: function( zip, on_complete )
	{
		//it could be nice to add a dialog to config the player options here
		var player_options = { 
			resources: "./",
			scene_url: "scene.json"
		};
		zip.file( "config.json", JSON.stringify( player_options ) );

		var files = this.player_files.concat();
		var filename = files.pop();
		LS.Network.requestFile( filename, inner );

		function inner( file )
		{
			//change player to index
			if(filename == "player.html")
				filename = "index.html";
			//add to zip
			zip.file( filename, file );

			if(!files.length)
				on_complete();
			//seek another file
			filename = files.pop();
			LS.Network.requestFile( filename, inner );
		}
	}
}


ExportModule.registerExporter({
	name:"zip",
	settings: {
		player: true,
		strip_unitnames: false
	},
	inspect: function(inspector)
	{
		var that = this;
		inspector.addCheckbox("Include player", this.settings.player, function(v){ that.settings.player = v; });
		inspector.addCheckbox("Strip unit names", this.settings.strip_unitnames, function(v){ that.settings.strip_unitnames = v; });
	},
	export: function( info, on_complete )
	{
		ExportModule.exportToZIP( this.settings.player, this.settings.strip_unitnames );
		if(on_complete)
			on_complete();
	}
});

ExportModule.registerExporter({
	name:"wbin",
	settings: {
		player: true
	},
	inspect: function(inspector)
	{
		var that = this;
	},
	export: function( info, on_complete )
	{
		ExportModule.exportToWBIN( info.resources );
		if(on_complete)
			on_complete();
	}
});


ExportModule.registerExporter({
	name:"obj",
	settings: {
		to_memory: false
	},
	inspect: function(inspector)
	{
		var that = this;
		inspector.addCheckbox("Export to memory", this.settings.to_memory, function(v){ that.settings.to_memory = v; });
	},
	export: function( info, on_complete )
	{
		ExportModule.exportToOBJ( this.settings.to_memory );
		if(on_complete)
			on_complete();
	}
});

CORE.registerModule( ExportModule );