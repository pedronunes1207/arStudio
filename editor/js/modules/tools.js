/*
	This module allows to change the tool used by the mouse when interacting with the viewport.
	properties:
	- name, description: info
	- icon: image
	- module: this will be the one receiving all the events, if no module is supplied the tool is used as the module
	- onEnable: callback when the tool is enabled
	- onDisable: callback when the tool is disabled
*/

var ToolsModule = {
	name: "tools",

	tool: 'select',

	current_tool: null,
	background_tools: [],
	tools: {},
	buttons: {},

	coordinates_system: 'object',

	_initialized: false,
	_active_camera: null, //camera under the mouse

	init: function() {

		for(var i in this.tools)
		{
			var tool = this.tools[i];
			if(tool.module && tool.module.onRegister)
			{
				tool.module.onRegister();
				tool.module.onRegister = null; //UGLY
			}
		}

		//initGUI
		//place to put all the icons of the tools (really? just use the events system)
		RenderModule.canvas_manager.addWidget(this);
		this.createToolbar();

		//render tools guizmos
		//LEvent.bind( LS.Renderer, "afterRenderScene", this.renderView.bind(this) ); //renderHelpers
	},

	registerTool: function(tool)
	{
		this.tools[ tool.name ] = tool;
	},

	registerButton: function( button )
	{
		this.buttons[button.name] = button;
	},

	// a tool that is always active (used for selection tool)
	addBackgroundTool: function( tool )
	{
		this.background_tools.push( tool );
	},

	keydown: function(e)
	{
		for(var i in ToolsModule.tools)
		{
			if(ToolsModule.tools[i].keyShortcut == e.keyCode)
			{
				ToolsModule.enableTool( ToolsModule.tools[i].name );
				break;
			}
		}
	},

	enableTool: function(name)
	{
		if(this.current_tool) {

			//avoid to reactivate same tool
			if(this.current_tool.name == name)
			{
				if( this.current_tool.onClick )
					this.current_tool.onClick();
				return;
			}

			if(this.current_tool.module) 
			{
				if(!this.current_tool.keep_module)
					RenderModule.canvas_manager.removeWidget(this.current_tool.module);
				this.current_tool.module.enabled = false;
			}
			else if(!this.current_tool.keep_module)
				RenderModule.canvas_manager.removeWidget(this.current_tool);
			this.current_tool.enabled = false;
			if (this.current_tool.onDisable)
				this.current_tool.onDisable();
		}

		var enabled = document.querySelectorAll("#canvas-tools .tool-button.enabled");
		for(var i = 0; i < enabled.length; i++)
			enabled[i].classList.remove("enabled");

		var old_tool = this.current_tool;
		this.current_tool = null;
		var tool = this.tools[name];
		if(!tool)
			return;

		this.current_tool = tool;
		if( this.current_tool.onClick )
			this.current_tool.onClick();

		if(tool.module)
		{ 
			RenderModule.canvas_manager.addWidget(tool.module);
			tool.module.enabled = true;
		}
		else RenderModule.canvas_manager.addWidget(tool);
		this.current_tool.enabled = true;

		if (this.current_tool.onEnable)
			this.current_tool.onEnable();

		if(old_tool && old_tool.inspect && InterfaceModule.inspector_widget.instance == old_tool)
			EditorModule.inspect( SelectionModule.getSelectedNode() );

		LiteGUI.trigger( this, "tool_enabled", this.current_tool );
		LS.GlobalScene.refresh();
	},

	showToolProperties: function( tool_name )
	{
		var tool = this.tools[ tool_name ];
		if(!tool)
			return;

		this.enableTool( tool_name );

		if(!tool.inspect)
			return;

		EditorModule.inspect( tool );
	},

	showButtonProperties: function( button_name )
	{
		var button = this.buttons[ button_name ];
		if(!button || !button.inspect)
			return;
		EditorModule.inspect( button );
	},

	//*
	//every frame
	render: function()
	{
		if (!this.current_tool || !RenderModule.frame_updated) 
			return;

		if(!this._active_camera)
			return;

		var camera = this._active_camera;
		LS.Renderer.enableCamera( camera ); //sets viewport, update matrices and set Draw
		this.renderView(null, camera);
	},
	//*/

	renderView: function(e, camera)
	{
		if (!this.current_tool)
			return;

		if( this.current_tool.renderEditor )
			this.current_tool.renderEditor( camera );
	},

	mouseevent: function(e)
	{
		if(this.background_tools.length)
		{
			for(var i = 0; i < this.background_tools.length; ++i)
			{
				var tool = this.background_tools[i];
				if(tool[e.type])
					if( tool[e.type](e) )
						break;
			}
		}
	},

	mousedown: function(e)
	{
		return this.mouseevent(e);
	},

	mouseup: function(e)
	{
		return this.mouseevent(e);
	},

	mousemove: function(e)
	{
		//when the mouse is not dragging we update active camera
		if(!e.dragging)
		{
			//active camera is the camera which viewport is below the mouse
			var viewport = RenderModule.getViewportUnderMouse(e);
			if(!viewport)
				return;
			var camera = viewport.camera;

			if( this._active_camera == camera )
				return;

			this._active_camera = camera;
			LS.GlobalScene.refresh();
		}
		else
		{
			return this.mouseevent(e);
		}
	},

	createToolbar: function()
	{
		//in case they exist
		LiteGUI.remove("#canvas-tools");
		LiteGUI.remove("#canvas-buttons");

		var root = LiteGUI.getById("mainmenubar");
		if(!root)
		{
			console.error("No menubar element found");
			return;
		}

		$(root).append("<div id='canvas-tools' class='ineditor'></div>");
		$(root).append("<div id='canvas-buttons' class='ineditor'></div>");

		for(var i in this.tools)
		{
			var tool = this.tools[i];
			if(tool.display == false)
				continue;
			this.addToolButton(tool);
		}

		for(var i in this.buttons)
		{
			var button = this.buttons[i];
			if(button.display == false)
				continue;
			this.addStateButton(button);
		}
	},

	addToolButton: function( tool )
	{
		var root = document.getElementById("canvas-tools");

		var element = this.createButton( tool, root );
		element.className += " tool-" + tool.name;

		if(!tool.className)
			tool.className = "tool";
		element.addEventListener("click", function(e){
			ToolsModule.enableTool( this.data );
			LS.GlobalScene.refresh();
			$("#canvas-tools .enabled").removeClass("enabled");
			if(!tool._stateful)
				this.classList.add("enabled");
		});

		element.addEventListener("contextmenu", function(e) { 
			if(e.button != 2) //right button
				return false;
			e.preventDefault(); 
			ToolsModule.showToolProperties( this.data );
			return false;
		} );

	},

	addStateButton: function( button )
	{
		var root = document.getElementById("canvas-buttons");

		var element = this.createButton( button, root );
		element.className += " tool-" + button.name + " " + (button.enabled ? "enabled":"");
		element.addEventListener("click", inner_onClick );

		function inner_onClick( e )
		{
			if(button.combo)
			{
				var section_name = "tool-section-" + button.section;
				$(root).find("." + section_name + " .tool-button").removeClass("enabled");
			}

			if(!button.callback)
				return;

			var ret = button.callback(e);
			if( ret !== undefined )
			{
				if(ret)
					this.classList.add("enabled");
				else
					this.classList.remove("enabled");
			}
			else if(!button.combo)
				this.classList.toggle("enabled");
			else
				this.classList.add("enabled");
			LS.GlobalScene.refresh();

			e.preventDefault();
			return false;
		}

		element.addEventListener("contextmenu", function(e) { 
			if(e.button != 2) //right button
				return false;
			e.preventDefault(); 
			ToolsModule.showButtonProperties( this.data );
			return false;
		});
	},

	createButton: function( button, root )
	{
		var element = document.createElement("div");
		element.className = "tool-button";
		element.data = button.name;
		if (button.icon) {
			element.style.backgroundImage = "url('" + button.icon + "')";
		}

		if(button.description)
			element.title = button.description;

		if(!button.section)
			button.section = "general";

		var section = this.getSection( button.section, root );
		if( !section )
			section = this.createSection( button.section, root );

		section.appendChild( element );
		return element;
	},

	getSection: function( name, root )
	{
		return root.querySelector(".tool-section-" + name);
	},

	createSection: function( name, root )
	{
		var section = root.querySelector(".tool-section-" + name);
		if( section )
			return section;

		var section_element = document.createElement("div");
		section_element.className = "tool-section tool-section-" + name;
		root.appendChild( section_element );
		return section_element;
	}
};

CORE.registerModule( ToolsModule );

//************* TOOLS *******************
var ToolUtils = {
	click_point: vec3.create(),

	getCamera: function(e)
	{
		if(!e)
			return ToolsModule._active_camera || RenderModule.camera;

		var x = e.canvasx;
		var y = e.canvasy;

		var cameras = RenderModule.getLayoutCameras();
		var camera = cameras[0];
		for(var i = cameras.length-1; i >= 0; --i)
		{
			if( cameras[i].isPointInCamera( x,y ) )
			{
				camera = cameras[i];
				break;
			}
		}
		return camera;
	},

	getCamera2D: function()
	{
		if(!this.camera_2d)
			this.camera_2d = new LS.Camera({eye:[0,0,0],center:[0,0,-1]});
		return this.camera_2d;
	},


	prepareDrawing: function()
	{
		var camera = this.getCamera();
		this.camera_eye = camera.getEye();
		this.camera_front = camera.getFront();
		this.camera_top = camera.getLocalVector([0,1,0]);
		this.camera_right = camera.getLocalVector([1,0,0]);
	},

	enableCamera2D: function(camera)
	{
		var camera2d = this.getCamera2D();

		if(camera) //copy viewport
			camera2d._viewport.set( camera._viewport );

		var viewport = camera2d.getLocalViewport(); //should be the same as gl.viewport_data

		camera2d.setOrthographic( viewport[0], viewport[0] + viewport[2], viewport[1], viewport[1] + viewport[3], -1, 1);
		camera2d.updateMatrices();
		LS.Draw.setViewProjectionMatrix( camera2d._view_matrix, camera2d._projection_matrix, camera2d._viewprojection_matrix );
		
		return camera2d;
	},

	getSelectionMatrix: function()
	{
		var m = SelectionModule.getSelectionTransform();

		if(m && ToolsModule.coordinates_system == 'world')
		{
			var pos = vec3.create();
			mat4.multiplyVec3( pos, m, pos );
			mat4.identity( m );
			mat4.setTranslation( m, pos );
		}

		return m;
	},

	/*
	//returns the matrix for the selected gizmo
	getNodeGizmoMatrix: function(node)
	{
		if(!node) return null;
		var model = null;
		var center = null;
		var camera = this.getCamera();
		
		if(node.transform)
		{
			center = node.transform.getGlobalPosition();
			if(ToolsModule.coordinates_system == 'object')
				model = node.transform.getMatrixWithoutScale();
			else if(ToolsModule.coordinates_system == 'world')
				model = node.transform.getMatrixWithoutRotation();
			else if(ToolsModule.coordinates_system == 'view')
			{
				var up = this.camera_up;
				model = mat4.lookAt(mat4.create(), center, vec3.subtract( vec3.create(), center, this.camera_eye ), up );
				mat4.invert(model, model);
			}
		}
		else
			return mat4.create();
		return model;
	},
	*/

	applyTransformToSelection: function(transform, center, node)
	{
		SelectionModule.applyTransformToSelection(transform, center, node);
	},

	applyTransformMatrixToSelection: function(matrix, center, node)
	{
		SelectionModule.applyTransformMatrixToSelection( matrix, center, node);
	},

	//special case, when transforming a bone you want to preserve the distance with the parent
	applyTransformMatrixToBone: function(matrix)
	{
		var scene = LS.GlobalScene;

		var node = scene.selected_node;
		var parent = node.parentNode;

		var pos = node.transform.getGlobalPosition();
		var parent_model = parent.transform.getGlobalMatrix();
		var parent_pos = parent.transform.getGlobalPosition();

		var end_pos = mat4.multiplyVec3( vec3.create(), matrix, pos );

		var A = vec3.sub( vec3.create(), pos, parent_pos );
		var B = vec3.sub( vec3.create(), end_pos, parent_pos );
		vec3.normalize(A,A);
		vec3.normalize(B,B);

		var axis = vec3.cross( vec3.create(), A, B );
		vec3.normalize(axis,axis);
		var angle = Math.acos( Math.clamp( vec3.dot(A,B), -1,1) );
		if( Math.abs(angle) < 0.00001 )
			return;

		var Q = quat.setAxisAngle( quat.create(), axis, angle);
		var R = mat4.fromQuat( mat4.create(), Q );

		this.applyTransformMatrixToSelection(R, parent_pos, parent );
		//parent.transform.applyTransformMatrix(R, true);
		scene.refresh();
	},
	
	//test the collision point of a ray passing a pixel against a perpendicular plane passing through center
	testPerpendicularPlane: function(x,y, center, result, camera)
	{
		camera = camera || this.getCamera();
		result = result || vec3.create();

		var ray = camera.getRayInPixel( x, gl.canvas.height - y );
		//ray.end = vec3.add( vec3.create(), ray.origin, vec3.scale(vec3.create(), ray.direction, 10000) );

		//test against plane
		var front = camera.getFront( this.camera_front );
		if( geo.testRayPlane( ray.origin, ray.direction, center, front, result ) )
			return true;
		return false;
	},

	computeRotationBetweenPoints: function( center, pointA, pointB, axis, reverse, scalar )
	{
		scalar = scalar || 1;
		var A = vec3.sub( vec3.create(), pointA, center );
		var B = vec3.sub( vec3.create(), pointB, center );
		vec3.normalize(A,A);
		vec3.normalize(B,B);
		var AcrossB = vec3.cross(vec3.create(),A,B);

		var AdotB = vec3.dot(A,B); //clamp
		//var angle = -Math.acos( AdotB );
		var angle = -Math.acos( Math.clamp( vec3.dot(A,B), -1,1) );
		if(angle)
		{
			if(!axis)
				axis = AcrossB;
			vec3.normalize(axis, axis);
			if( reverse && vec3.dot(AcrossB, axis) < 0 )
				angle *= -1;
			angle *= scalar;
			if(!isNaN(angle) && angle)
				return quat.setAxisAngle( quat.create(), axis, angle );
		}

		return quat.create();
	},

	computeDistanceFactor: function(v, camera)
	{
		camera = camera || RenderModule.camera;
		return Math.tan(camera.fov * DEG2RAD) * vec3.dist( v, camera.getEye() );
	},

	//useful generic methods
	saveNodeTransformUndo: function(node)
	{
		if(!node || node.constructor !== LS.SceneNode)
		{
			console.error("saveNodeTransformUndo node must be SceneNode");
			return;
		}

		CORE.userAction("node_transform",node);
		//UndoModule.saveNodeTransformUndo(node);
	},

	saveSelectionTransformUndo: function()
	{
		CORE.userAction("nodes_transform", SelectionModule.getSelectedNodes() );
		//UndoModule.saveNodeTransformUndo(node);
		//UndoModule.saveNodesTransformUndo( SelectionModule.getSelectedNodes() );
	},

	afterSelectionTransform: function()
	{
		CORE.afterUserAction("nodes_transform", SelectionModule.getSelectedNodes() );
	},

	//test if a ray collides circle
	testCircle: (function(){ 
		var temp = vec3.create();
		return function(ray, axis, center, radius, result, tolerance )
		{
			tolerance = tolerance || 0.1;
			//test with the plane containing the circle
			if( geo.testRayPlane( ray.origin, ray.direction, center, axis, result ) )
			{
				var dist = vec3.dist( result, center );
				var diff = vec3.subtract( temp, result, center );
				vec3.scale(diff, diff, 1 / dist); //normalize?
				if( Math.abs(radius - dist) < radius * tolerance && vec3.dot(diff, ray.direction) < 0.0 )
				{
					result.set( diff );
					vec3.scale( result, result, radius );
					return true;
				}
			}
			return false;
		}
	})()
};


//######################################################################################################################
//==============================================
// Tool definition for 'no tool' button (top left)
//==============================================
var notoolButton = {
	name: "notool-button",
	description: "Deselect any tool selected",
	icon: "skins/" + CORE.config.skin + "/imgs/mini-icon-circle.png",
	section: "main",

	callback: function()
	{
		ToolsModule.enableTool(null);
		//$("#canvas-tools .enabled").removeClass("enabled");
		return false;
	}
};

ToolsModule.registerButton(notoolButton);


//######################################################################################################################
//==============================================
// Do scaling of selected object using mousewheel.
//==============================================
var mouseWheelScaler = {
	name: "mousewheel-scaler",
	description: "(NEW) Change scale using left mouse button + mouse wheel",
	icon: "skins/" + CORE.config.skin + "/imgs/acts/scale.png",
	section: "manipulate",

	_action: true,

	_debug_pos: vec3.create(),
	_x_axis_end: vec3.create(),
	_y_axis_end: vec3.create(),
	_z_axis_end: vec3.create(),
	_center: vec3.create(),
	_closest: vec3.create(),
	_on_top_of: null,
	_click_world_position: vec3.create(),

	_handles_color: [1.0, 0.0, 1.0, 1.0],	// Color of handles.. seems colors are A R G B ?

	renderEditor: function(camera)
	{
		// cw: copied from the scale rendereditor
		var node = SelectionModule.getSelectedNode();
		if(!node || !node.transform)
			return;
		if(!EditorView.mustRenderGizmos())
			return;

		ToolUtils.prepareDrawing();

		var gizmo_model = ToolUtils.getSelectionMatrix();
		var center = vec3.create();
		mat4.multiplyVec3(center,gizmo_model,center);
		var f = ToolUtils.computeDistanceFactor(center);

		this._center.set( center );

		var scale = f *0.15;
		scaleNodeTool._radius = scale;

	//	var colorx = scaleNodeTool._on_top_of == "x" ? [1,1,0,1] : [1,1,0,1];
	//	var colory = scaleNodeTool._on_top_of == "y" ? [1,1,0,1] : [1,1,0,1];
	//	var colorz = scaleNodeTool._on_top_of == "z" ? [1,1,0,1] : [1,1,0,1];

		var colorx = this._handles_color;
		var colory = this._handles_color;
		var colorz = this._handles_color;


//		var colorx = _handles_color;
//		var colory = _handles_color;
//		var colorz = _handles_color;

		if( scaleNodeTool._on_top_of == "center" )
		{
			vec3.add(colorx, colorx,[0.4,0.4,0.4]);
			vec3.add(colory, colory,[0.4,0.4,0.4]);
			vec3.add(colorz, colorz,[0.4,0.4,0.4]);
		}

		gl.disable(gl.DEPTH_TEST);
		LS.Draw.setColor([0.5,0.5,0.5]);
		LS.Draw.push();
		LS.Draw.setMatrix(gizmo_model);

		mat4.multiplyVec3(scaleNodeTool._x_axis_end, gizmo_model, [scale,0,0] );
		mat4.multiplyVec3(scaleNodeTool._y_axis_end, gizmo_model, [0,scale,0] );
		mat4.multiplyVec3(scaleNodeTool._z_axis_end, gizmo_model, [0,0,scale] );

		LS.Draw.renderLines( [[0,0,0],[scale,0,0],[0,0,0],[0,scale,0],[0,0,0],[0,0,scale]]);

		LS.Draw.setColor(colorx);
		LS.Draw.translate([scale,0,0]);
		LS.Draw.renderSolidBox(scale*0.1,scale*0.1,scale*0.1);
		LS.Draw.setColor(colory);
		LS.Draw.translate([-scale,scale,0]);
		LS.Draw.renderSolidBox(scale*0.1,scale*0.1,scale*0.1);
		LS.Draw.setColor(colorz);
		LS.Draw.translate([0,-scale,scale]);
		LS.Draw.renderSolidBox(scale*0.1,scale*0.1,scale*0.1);
		LS.Draw.pop();

		gl.enable(gl.DEPTH_TEST);
	},

	mousedown: function(e)
	{
		if(!this.enabled)
			return;

		if(e.which != GL.LEFT_MOUSE_BUTTON)
			return;

		this._freeze_axis = true;

		var selection = SelectionModule.getSelection();
		if(!selection)
			return;

		if( e.metaKey || e.altKey )
		{
			this._on_top_of = null;
			return;
		}

		var node = selection.node;

		if( e.shiftKey && this._on_top_of )
		{
			var instances = SelectionModule.cloneSelectedInstance();
			if(instances)
				SelectionModule.setMultipleSelection(instances, false);
		}
		else
		{
			if( moveTool._on_top_of ) //action is going to be performed so we save undo...
			{
				var selection_info = SelectionModule.getSelection();
				//root component transforms do not affect Transform so we save the compo state
				if( selection_info && selection_info.node && selection_info.node === LS.GlobalScene.root )
					CORE.userAction("component_changed", selection_info.instance );
				else //save transform
					ToolUtils.saveSelectionTransformUndo();
			}
		}

		//get collision point with perpendicular plane
		var gizmo_model = ToolUtils.getSelectionMatrix();
		if(!gizmo_model)
			return;

		var center = vec3.create();
		mat4.multiplyVec3(center, gizmo_model, center);

		if(ToolUtils.testPerpendicularPlane(e.mousex, e.mousey, center, this._click_world_position))
			vec3.copy(this._debug_pos, this._click_world_position);

		//this._action = true;
	},

	mouseup: function(e) {
		this._action = false;

		if(!this.enabled)
			return;
		if(e.which != GL.LEFT_MOUSE_BUTTON)
			return;

		this._freeze_axis = false;
		var selection_info = SelectionModule.getSelection();
		//root component transforms do not affect Transform so we save the compo state
		if( selection_info && selection_info.node && selection_info.node === LS.GlobalScene.root )
			CORE.afterUserAction("component_changed", selection_info.instance );
		else
			ToolUtils.afterSelectionTransform();
		EditorModule.refreshAttributes();
	},

	mousemove: function(e)
	{
		if(!this.enabled)
			return;

		LS.GlobalScene.refresh();

		var selection = SelectionModule.getSelection();
		if(!selection)
			return;

		var camera = ToolUtils.getCamera();
		//camera.updateMatrices();

		var gizmo_model = ToolUtils.getSelectionMatrix();
		if(!gizmo_model)
			return;

		var center = vec3.create();
		mat4.multiplyVec3( center,gizmo_model,center );

		var ray = camera.getRayInPixel( e.mousex, gl.canvas.height - e.mousey );
		ray.end = vec3.add( vec3.create(), ray.origin, vec3.scale(vec3.create(), ray.direction, 10000) );
		moveTool._last_ray = ray;

		if (e.dragging && e.which == GL.LEFT_MOUSE_BUTTON) {

			var f = 0.001 * ToolUtils.computeDistanceFactor(center);
			var delta = vec3.create();

			if(!moveTool._on_top_of)
			{
				return;
			}

			if(moveTool._on_top_of == "center") //parallel to camara
			{
				var current_position = vec3.create();
				ToolUtils.testPerpendicularPlane(e.mousex, e.mousey, center, current_position );
				vec3.sub(delta, current_position, this._click_world_position);
				vec3.copy(this._click_world_position, current_position);
				vec3.copy(this._debug_pos, this._click_world_position);

				//mat4.rotateVec3(delta, model, [e.deltax * f,-e.deltay * f,0] );
				//node.transform.translate(delta[0],delta[1],delta[2]);
			}
			else //using axis
			{
				var closest = vec3.create();
				var axis = null;
				var is_plane = false;

				if(moveTool._on_top_of == "y")
					axis = moveTool._y_axis_end;
				else if(moveTool._on_top_of == "z")
					axis = moveTool._z_axis_end;
				else if(moveTool._on_top_of == "x")
					axis = moveTool._x_axis_end;
				else if(moveTool._on_top_of == "xz")
				{
					is_plane = true;
					axis = moveTool._y_axis_end;
				}
				else if(moveTool._on_top_of == "yz")
				{
					is_plane = true;
					axis = moveTool._x_axis_end;
				}
				else if(moveTool._on_top_of == "xy")
				{
					is_plane = true;
					axis = moveTool._z_axis_end;
				}

				if( is_plane )
				{
					var axis = vec3.subtract( vec3.create(), axis, moveTool._center );
					vec3.normalize( axis, axis );
					geo.testRayPlane( ray.origin, ray.end, moveTool._center, axis, closest );
				}
				else
					geo.closestPointBetweenLines( ray.origin, ray.end, moveTool._center, axis, null, closest );

				vec3.subtract( delta, closest, moveTool._closest);
				vec3.copy( moveTool._closest, closest );
			}

			if(delta[0] == 0 && delta[1] == 0 && delta[2] == 0)
				return true;

			var T = mat4.setTranslation( mat4.create(), delta );

			ToolUtils.applyTransformMatrixToSelection(T);
			//node.transform.applyTransformMatrix(T, true);
			EditorModule.updateInspector();
			return true;
		}
		else //not dragging
		{
			var result = vec3.create();

			vec3.copy( moveTool._debug_pos, result );
			var radius = vec3.dist( moveTool._center, moveTool._x_axis_end);

			if ( geo.testRaySphere( ray.origin, ray.direction, moveTool._center, radius*1.1, result ) )
			{
				vec3.copy( moveTool._closest, result );
				if ( geo.testRaySphere( ray.origin, ray.direction, moveTool._center, radius*0.05, result ) )
					moveTool._on_top_of = "center";
				else
				{
					var close_to_x = geo.testRayCylinder( ray.origin, ray.direction, moveTool._center, moveTool._x_axis_end, radius*0.25, result );
					var close_to_y = geo.testRayCylinder( ray.origin, ray.direction, moveTool._center, moveTool._y_axis_end, radius*0.25, result );
					var close_to_z = geo.testRayCylinder( ray.origin, ray.direction, moveTool._center, moveTool._z_axis_end, radius*0.25, result );
					var axis_end = null;

					if(close_to_x)
					{
						if(close_to_y)
						{
							moveTool._on_top_of = "xy";
							axis_end = moveTool._z_axis_end;
						}
						else if(close_to_z)
						{
							moveTool._on_top_of = "xz";
							axis_end = moveTool._y_axis_end;
						}
						else
						{
							geo.closestPointBetweenLines( ray.origin, ray.end, moveTool._center, moveTool._x_axis_end, null, moveTool._closest );
							moveTool._on_top_of = "x";
						}
					}
					else if( close_to_y )
					{
						if( close_to_z )
						{
							axis_end = moveTool._x_axis_end;
							moveTool._on_top_of = "yz";
						}
						else
						{
							geo.closestPointBetweenLines( ray.origin, ray.end, moveTool._center, moveTool._y_axis_end, null, moveTool._closest );
							moveTool._on_top_of = "y";
						}

					}
					else if( close_to_z )
					{
						geo.closestPointBetweenLines( ray.origin, ray.end, moveTool._center, moveTool._z_axis_end, null, moveTool._closest );
						moveTool._on_top_of = "z";
					}
					else
						moveTool._on_top_of = null;

					if(axis_end)
					{
						var axis = vec3.create();
						vec3.subtract( axis, axis_end, moveTool._center );
						vec3.normalize( axis, axis );
						geo.testRayPlane( ray.origin, ray.end, moveTool._center, axis, moveTool._closest );
					}
				}
			}
			else
				moveTool._on_top_of = null;
			EditorModule.updateInspector();
			LS.GlobalScene.refresh();
		}
	},

	mousewheel: function(e)
	{
		if(!this.enabled) return;


		var node = SelectionModule.getSelectedNode();
		if(!node || !node.transform)
			return;
		var camera = ToolUtils.getCamera();

		var pos2D = camera.project(this._center);

		if (e.leftButton!=0/*e.dragging && e.which == GL.LEFT_MOUSE_BUTTON*/)	//cw: seems to be 2
		{

			// cw: If dragging, change scale of selected object


			//cw: change scale depending on movement of mouse wheel.

			var f = 1 + (e.deltax + e.deltay) * 0.005;
			var click_pos2D = vec3.fromValues(e.canvasx, e.canvasy, 0);
			var dist = vec3.distance(pos2D, click_pos2D);
			var scale_factor = dist / this._dist;
			this._dist = dist;
			if (scale_factor > 20) scale_factor = 20;
			if (scale_factor < 0.01) scale_factor = 0.01;

			var wScale = e.wheel;
			if (wScale < 0) wScale = 1.1;
			else wScale = 0.9;

			node.transform.scale( wScale,  wScale, wScale);

			LS.GlobalScene.refresh();
			return true;
		}
		/*
		if(!e.dragging) return;
		if(moveTool._on_top_of != "center") return;
		var selection = SelectionModule.getSelection();
		if(!selection)
			return;

		var camera = ToolUtils.getCamera();
		var eye = camera.getEye();
		var gizmo_model = ToolUtils.getSelectionMatrix();
		var center = vec3.create();
		mat4.multiplyVec3(center,gizmo_model,center);

		var delta = vec3.sub(vec3.create(), eye, center );

		vec3.scale(delta,delta, e.wheel < 0 ? 0.05 : -0.05 );
		var T = mat4.setTranslation( mat4.create(), delta );
		//node.transform.applyTransformMatrix(T, true);
		ToolUtils.applyTransformMatrixToSelection(T);

		vec3.add( this._click_world_position, this._click_world_position, delta );
		EditorModule.updateInspector();
		LS.GlobalScene.refresh();
		return true;*/

	}
};

//ToolsModule.registerTool(mouseWheelScaler);

