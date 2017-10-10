/* Actions system
Actions are commands that you could perform in nodes or components, like copy,paste, clone, delete, get info, etc
They could be performed using the right mouse button or the quickbar
To retrieve the actions the system calls getEditorActions in the instance, this should return an object containing action name and info about the action.

When performing an action the system calls doEditorAction in the instance, passing the name.
*/

/* Scene Node Actions *********************************************/
LS.SceneNode.actions = {};

LS.SceneNode.prototype.getActions = function( actions )
{
	actions = actions || {};
	for(var i in LS.SceneNode.actions)
		actions[i] = LS.SceneNode.actions[i];
	return actions;
}

LS.SceneNode.prototype.doAction = function( name_action )
{
	if(!name_action)
		return;

	var action = null;
	if(name_action.constructor === String)
	{
		var actions = this.getActions();
		if(!actions || !actions[name_action])
			return false;
		action = actions[name_action];
	}
	else
		action = name_action;

	if(action.callback)
		return action.callback.call(this);

	return false;
}

LS.SceneNode.actions["select"] = { 
	title:"Select",
	callback: function(){
		SelectionModule.setSelection( this );
	}
};

LS.SceneNode.actions["select_children"] = { 
	title:"Select Children",
	callback: function(){
		var children = this.getDescendants();
		children.push( this );
		SelectionModule.setMultipleSelection( children );
	}
};

LS.SceneNode.actions["clone"] = { 
	title:"Clone",
	callback: function(){
		EditorModule.cloneNode( this, true ); //true = use_same_parent
	}
};

LS.SceneNode.actions["move_before"] = { 
	title:"Move before sibling",
	callback: function(){
		this.moveBefore();
	}
};

LS.SceneNode.actions["move_after"] = { 
	title:"Move after sibling",
	callback: function(){
		this.moveAfter();
	}
};

LS.SceneNode.actions["create_child_node"] = { 
	title:"Create Child Node",
	callback: function(){
		EditorModule.createNullNode( this );
	}
};

LS.SceneNode.actions["create_prefab"] = { 
	title:"Create Prefab",
	callback: function(){
		PackTools.showCreatePrefabDialog( this );
	}
};

LS.SceneNode.actions["use_prefab"] = { 
	title:"Assign Prefab",
	callback: function(){
		var node = this;
		EditorModule.showSelectResource( { type:"Prefab", on_complete: function(v){
			node.prefab = v;
			EditorModule.showNodeInfo(node);
		}});
	}
};


LS.SceneNode.actions["inspect_in_dialog"] = { 
	title:"Inspect in dialog",
	callback: function(){
		EditorModule.inspectInDialog(this);
	}
};

LS.SceneNode.actions["info"] = { 
	title:"Show Information",
	callback: function(){
		EditorModule.showNodeInfo(this);
	}
};

LS.SceneNode.actions["addcomponent"] = { 
	title:"Add Component",
	callback: function(){
		EditorModule.showAddComponentToNode( this, function(){ EditorModule.refreshAttributes(); } );
	}
};

LS.SceneNode.actions["layers"] = { 
	title:"Show Layers",
	callback: function(){
		var node = this;
		EditorModule.showLayersEditor( node.layers, function(v){
			node.layers = v;
			RenderModule.requestFrame();
		});
	}
};

LS.SceneNode.actions["delete"] = { 
	title:"Delete",
	callback: function(){
		EditorModule.deleteNode( this );
	}
};

/* Components *************************/
LS.Component.actions = {};

LS.Component.getActions = function( component )
{
	var actions = {};

	//global component actions (like copy, paste, delete)
	for(var i in LS.Component.actions)
		actions[i] = LS.Component.actions[i];

	//specific actions of a component
	if( component.constructor.actions )
		for(var i in component.constructor.actions)
		{
			var action = component.constructor.actions[i];
			//allows to skip to show actions in some special cases
			if(action.callback_show && action.callback_show.call(component) == false )
				continue;
			actions[i] = action;
		}

	//actions specific of this component
	if( component.getActions )
		actions = component.getActions( actions );

	return actions;
}

LS.Component.doAction = function( component, name_action )
{
	if(!name_action)
		return;

	var action = null;
	if(name_action.constructor === String)
	{
		var actions = this.getActions( component );
		if(!actions || !actions[name_action])
			return false;
		action = actions[name_action];
	}
	else
		action = name_action;
	if(action.callback)
		return action.callback.call(component);
	return false;
}


LS.Component.actions["enable"] = { 
	title:"Enable/Disable",
	callback: function(){
		this.enabled = !this.enabled;
	}
};


LS.Component.actions["info"] = { 
	title:"Show Information",
	callback: function(){
		EditorModule.showComponentInfo(this);
	}
};

LS.Component.actions["copy"] = { 
	title:"Copy",
	callback: function(){
		EditorModule.copyComponentToClipboard(this);
	}
};

LS.Component.actions["paste"] = { 
	title:"Paste",
	callback: function(){
		EditorModule.pasteComponentFromClipboard(this);
	}
};

LS.Component.actions["paste"] = { 
	title:"Paste",
	callback: function(){
		EditorModule.pasteComponentFromClipboard(this);
	}
};

LS.Component.actions["delete"] = { 
	title:"Delete",
	callback: function(){
		EditorModule.deleteNodeComponent(this);
	}
};

LS.Component.actions["reset"] = { 
	title:"Reset",
	callback: function(){
		EditorModule.resetNodeComponent(this);
	}
};

LS.Component.actions["share"] = { 
	title:"Share",
	callback: function(){
		EditorModule.shareNodeComponent(this);
	}
};

LS.Component.actions["select"] = { 
	title:"Select",
	callback: function(){
		SelectionModule.setSelection(this);
	}
};



/*
LS.Components.Transform.prototype.getEditorActions = function( actions )
{
	delete actions["delete"];
	return actions;
}
*/

LS.Components.Light.actions["select_target"] = { title: "Select Target", callback: function() { SelectionModule.setSelection({ instance: this, info: "target" }); }};
LS.Components.Camera.actions["select_center"] = { title: "Select Center", callback: function() { SelectionModule.setSelection({ instance: this, info: "center"}); }};
LS.Components.Camera.actions["setview"] = { title: "Set to view", callback: function() { 
	var active = RenderModule.getActiveCamera();
	var index = 0;
	if( active._editor )
		index = active._editor.index;
	RenderModule.setViewportCamera( index, this );
	LS.GlobalScene.refresh();
}};

LS.Components.Camera.actions["preview"] = { title: "Preview", callback: function() { 
		cameraTool.addCameraPreviewWidget( this );
		LS.GlobalScene.refresh();
	}
};

LS.Components.Light.actions["edit_layers"] = LS.Components.Camera.actions["edit_layers"] = { title: "Edit Layers", callback: function() { 
		var component = this;
		EditorModule.showLayersEditor( this.layers, function(v){
			component.layers = v;
			RenderModule.requestFrame();
		});	
	}
};

LS.Components.Light.actions["to_node"] = { 
	title: "Detach to SceneNode", 
	callback_show: function()
	{
		return (this._root && this._root._is_root );
	},
	callback: function() { 
		var node = new LS.SceneNode();
		node.name = "light";
		node.transform.lookAt( this.getPosition(), this.getTarget(), this.getUp() );
		this._root.removeComponent( this );
		CORE.userAction("component_deleted",this);
		node.addComponent( this );
		CORE.userAction("node_created",node);
		LS.GlobalScene.root.addChild( node );
		LS.GlobalScene.refresh();
		EditorModule.refreshAttributes();
	}
};

LS.Components.SkinDeformer.actions["convert_bones"] = { title: "Convert Bones to Relative", callback: function() { this.convertBonesToRelative(); }};
//LS.Components.SkinDeformer.actions["set_to_bind_pose"] = { title: "Set bones to bind pose", callback: function() { this.setBonesToBindPose(); }};
LS.Components.MorphDeformer.actions["optimize_moprhtargets"] = { title: "Optimize Morph Targets", callback: function() { this.optimizeMorphTargets(); }};


LS.Components.Skybox.actions["bake"] = { 
	title:"Bake to Cubemap",
	callback: function(){
		this.bakeToCubemap( 512 );
		RenderModule.requestFrame();
	}
};


//*********** Material Actions *************************************


LS.MaterialClasses.StandardMaterial.actions = {}

LS.MaterialClasses.StandardMaterial.actions["to_newStandardMaterial"] = {
	title:"Convert to newStandardMaterial",
	callback: function( node )
	{
		var info = this.serialize();
		info.object_class = "newStandardMaterial";
		delete info.uid;
		var new_material = new LS.MaterialClasses.newStandardMaterial();
		new_material.configure( info );
		node.material = new_material;
	}
}


/*
LS.Material.actions = {};

LS.Material.actions["copy"] = { title: "Copy", callback: function() { 
};

"Copy","Paste","Delete","Share","Instance"
*/