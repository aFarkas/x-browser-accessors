(function($){
	var basePath = (function(){
		var scripts = $('script'),
			path 	= scripts[scripts.length - 1].src.split('?')[0]
		;
		return path.slice(0, path.lastIndexOf("/") + 1);
	})();
	var has = Object.prototype.hasOwnProperty;
	var support = $.support;
	
	var testElem = $('<div />')[0];
	testElem.setAttribute('dataHttpAttr', ':-)');
	
	support.contentAttr = !(testElem.dataHttpAttr);
	support.advancedObjectProperties = !!(Object.create && Object.defineProperties && Object.getOwnPropertyDescriptor);
	support.objectAccessor = !!( support.advancedObjectProperties || (Object.prototype.__defineGetter__ && Object.prototype.__lookupSetter__));
	support.domAccessor = !!( support.advancedObjectProperties || (Object.prototype.__defineGetter__ && Object.prototype.__lookupSetter__) ||  (Object.defineProperty && Object.getOwnPropertyDescriptor));
	support.dhtmlBehavior = !!(document.createStyleSheet && (testElem.style.behavior != null || testElem.style.MsBehavior != null));
	
	window.webshims = {};
	
	(function(){
		var descProps = ['configurable', 'enumerable', 'writable'];
		var extendUndefined = function(prop){
			for(var i = 0; i < 3; i++){
				if(prop[descProps[i]] === undefined && (descProps[i] !== 'writable' || prop.value !== undefined)){
					prop[descProps[i]] = true;
				}
			}
		};
		var extendProps = function(props){
			if(props){
				for(var i in props){
					if(has.call(props, i)){
						extendUndefined(props[i]);
					}
				}
			}
		};
		webshims.objectCreate = function(proto, props, opts){
			extendProps(props);
			var o = Object.create(proto, props);
			if(opts){
				o.options = $.extend(true, {}, o.options  || {}, opts);
				opts = o.options;
			}
			if(o._create && $.isFunction(o._create)){
				o._create(opts);
			}
			return o;
		};
		webshims.defineProperty = function(obj, prop, desc){
			extendUndefined(desc);
			return Object.defineProperty(obj, prop, desc);
		};
		webshims.defineProperties = function(obj, props){
			extendProps(props);
			return Object.defineProperties(obj, props);
		};
		webshims.getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
	})();
	
	var supportDefineDOMProp = true;
if(Object.defineProperty && Object.prototype.__defineGetter__){
	(function(){
		try {
			var foo = document.createElement('foo');
			Object.defineProperty(foo, 'bar', {get: function(){return true;}});
			supportDefineDOMProp = !!foo.bar;	
		}catch(e){
			supportDefineDOMProp = false;
		}
		if(!supportDefineDOMProp){
			jQuery.support.advancedObjectProperties = false;
		}
	})();
}

if((!supportDefineDOMProp || !Object.create || !Object.defineProperties || !Object.getOwnPropertyDescriptor  || !Object.defineProperty)){
	var shims = webshims;
	webshims.objectCreate = function(proto, props, opts){
		var o;
		var f = function(){};
		
		f.prototype = proto;
		o = new f();
		if(props){
			webshims.defineProperties(o, props);
		}
		
		if(opts){
			o.options = jQuery.extend(true, {}, o.options || {}, opts);
			opts = o.options;
		}
		
		if(o._create && jQuery.isFunction(o._create)){
			o._create(opts);
		}
		return o;
	};
	
	webshims.defineProperties = function(object, props){
		for (var name in props) {
			if (has.call(props, name)) {
				webshims.defineProperty(object, name, props[name]);
			}
		}
		return object;
	};
	
	var descProps = ['configurable', 'enumerable', 'writable'];
	webshims.defineProperty = function(proto, property, descriptor){
		if(typeof descriptor != "object"){return proto;}
		
		
		if(Object.defineProperty){
			for(var i = 0; i < 3; i++){
				if(!(descProps[i] in descriptor) && (descProps[i] !== 'writable' || descriptor.value !== undefined)){
					descriptor[descProps[i]] = true;
				}
			}
			try{
				Object.defineProperty(proto, property, descriptor);
				return;
			} catch(e){}
		}
		if(has.call(descriptor, "value")){
			proto[property] = descriptor.value;
			return proto;
		}
		
		if(proto.__defineGetter__){
            if (typeof descriptor.get == "function") {
				proto.__defineGetter__(property, descriptor.get);
			}
            if (typeof descriptor.set == "function"){
                proto.__defineSetter__(property, descriptor.set);
			}
        }
		return proto;
	};
	
	//based on http://www.refactory.org/s/object_getownpropertydescriptor/view/latest 
	webshims.getOwnPropertyDescriptor = function(obj, prop){
		var descriptor;
		if(Object.defineProperty && Object.getOwnPropertyDescriptor){
			try{
				//IE8
				descriptor = Object.getOwnPropertyDescriptor(obj, prop);
				return descriptor;
			} catch(e){}
		}
        descriptor = {
            configurable: true,
            enumerable: true,
            writable: true,
            value: undefined
        };
		var getter = obj.__lookupGetter__ && obj.__lookupGetter__(prop), 
			setter = obj.__lookupSetter__ && obj.__lookupSetter__(prop)
		;
        
        if (!getter && !setter) { // not an accessor so return prop
        	if(!has.call(obj, prop)){
				return;
			}
            descriptor.value = obj[prop];
            return descriptor;
        }
        
        // there is an accessor, remove descriptor.writable; populate descriptor.get and descriptor.set
        delete descriptor.writable;
        delete descriptor.value;
        descriptor.get = descriptor.set = undefined;
        
        if(getter){
			descriptor.get = getter;
		}
        
        if(setter){
            descriptor.set = setter;
		}
        
        return descriptor;
    };

}
	webshims.extendedProps = {};
	
	webshims.defineNodeNameProperty = function(nodeName, prop, desc, htc){
		$.extend(desc, {enumerable: true});
		var proto;
		if(support.objectAccessor && support.contentAttr){
			try {
				proto = document.createElement(nodeName).constructor.prototype;
			} catch(e){}
			if(proto){
				webshims.defineProperty(proto, prop, desc);
			}
		} else if(support.dhtmlBehavior){
			if(!webshims.extendedProps[nodeName]){
				webshims.extendedProps[nodeName] = {};
			}
			webshims.extendedProps[nodeName][prop] = {
				get: function(elem){
					return desc.get.call(elem);
				},
				set: function(elem, value){
					return desc.set.call(elem, value);
				}
			};
			addBehavior(nodeName, htc);
		}
	};
	
	var addBehavior = (function(){
		if(!document.createStyleSheet){return;}
		
		var span = testElem;
		var bindProp;
		if(span.style.behavior != null){
			bindProp = 'behavior';
		} else if(span.style.MsBehavior != null){
			bindProp = 'MsBehavior';
		} else {
			return;
		}
		var ss = document.createStyleSheet();
		var rules = ss.rules;
		var ruleNumber = -1;
		var addedBehaviors = {};

		return function(sel, file){
			var selBehavior = addedBehaviors[sel];
			file = 'url('+ basePath + file +'.htc)';
			if(!selBehavior){
				ruleNumber++;
				addedBehaviors[sel] = {
					files: [file],
					index: ruleNumber
				};
				ss.addRule(sel, bindProp+': '+ file +';');
			} else if($.inArray(file, selBehavior) == -1) {
				files = selBehavior.files;
				files.push(file);
				
				rules[selBehavior.index].style.cssText = bindProp+': '+ (files.join(', '));
							
			}

		};
	})();
	
})(jQuery);
