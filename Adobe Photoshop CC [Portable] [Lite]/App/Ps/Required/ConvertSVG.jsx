// Copyright 2012 Adobe Systems Incorporated.  All Rights reserved.

//
// Convert layer data into SVG output.
//

// This uses many routines from CopyCSS, so load the script but tell it not to execute first.
runCopyCSSFromScript = true; 
if (typeof cssToClip == "undefined")
{
    var appFolder = { Windows:"/", Macintosh:"/Adobe Photoshop CC.app/Contents/" };
    $.evalFile( app.path + appFolder[File.fs] + "Required/CopyCSSToClipboard.jsx" );
}

const ksendLayerThumbnailToNetworkClientStr = app.stringIDToTypeID ("sendLayerThumbnailToNetworkClient");
const krawPixmapFilePathStr = app.stringIDToTypeID("rawPixmapFilePath");
const kformatStr = app.stringIDToTypeID( "format" );
const kselectedLayerStr = app.stringIDToTypeID( "selectedLayer" );
const kwidthStr = app.stringIDToTypeID( "width" );
const kheightStr = app.stringIDToTypeID( "height" );
const kboundsStr = app.stringIDToTypeID("bounds" );
const klayerIDStr = app.stringIDToTypeID("layerID");

function ConvertSVG()
{
	// Construction is actually done by "reset" function.
}

svg = new ConvertSVG();

svg.reset = function()
{
	this.svgText = "";
	this.svgDefs = "";
	this.gradientID = 0;
	this.filterID = 0;
	this.groupLevel = 0;
	this.currentLayer = null;
	this.saveUnits = null;
	this.startTime = 0;
	this.savedGradients = [];
	this.gradientDict = {};
	// Yes, you really need all this gobbledygook
	this.svgHeader = ['<?xml version="1.0" encoding="utf-8"?>',
							 '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">',
							 '<svg version="1.1" baseProfile="full"',
							 '	xmlns="http://www.w3.org/2000/svg"',
							 '	xmlns:xlink="http://www.w3.org/1999/xlink"',
							 '	xmlns:ev="http://www.w3.org/2001/xml-events" >\n'].join('\n');
}

// Lifted from: https://github.com/douglascrockford/JSON-js/blob/master/json2.js
svg.jsquote = function( string ) 
{
	var escapable = /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
		 // table of character substitutions
	      meta = { '\b': '\\b', '\t': '\\t', '\n': '\\n', '\f': '\\f', '\r': '\\r', '"' : '\\"', '\\': '\\\\' };

		// If the string contains no control characters, no quote characters, and no
		// backslash characters, then we can safely slap some quotes around it.
		// Otherwise we must also replace the offending characters with safe escape sequences.
        escapable.lastIndex = 0;
        return escapable.test(string) ? '"' + string.replace(escapable, function (a) {
            var c = meta[a];
            return typeof c === 'string'
                ? c
                : '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
        }) + '"' : '"' + string + '"';
}

// Convert special characters to &#NN; form.
// http://stackoverflow.com/questions/784586/
svg.HTMLEncode = function (str)
{
	var i = str.length, result = [];

	while (i--)
	{
		var iC = str[i].charCodeAt();
		result[i] = (iC < 65 || iC > 127 || (iC>90 && iC<97))
						 ? '&#'+iC+';' : str[i];
	}
	return result.join('');    
}

// Encode data as Base64.  From http://www.webtoolkit.info/javascript-base64.html via StackOverflow
svg.encodeBase64 = function(input)
{
    var _keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    var output = "";
    var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
    var i = 0;

    while (i < input.length) {

        chr1 = input.charCodeAt(i++);
        chr2 = input.charCodeAt(i++);
        chr3 = input.charCodeAt(i++);

        enc1 = chr1 >> 2;
        enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
        enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
        enc4 = chr3 & 63;

        if (isNaN(chr2)) {
            enc3 = enc4 = 64;
        } else if (isNaN(chr3)) {
            enc4 = 64;
        }

        output = output +
        _keyStr.charAt(enc1) + _keyStr.charAt(enc2) +
        _keyStr.charAt(enc3) + _keyStr.charAt(enc4);
    }

    return output;
}

// Call internal PS code to write the current layer's pixels and convert it to PNG.
svg.writeLayerPNGfile = function( path )
{
	var desc = new ActionDescriptor();

	//    desc.putBoolean( kselectedLayerStr, true );
	desc.putInteger( klayerIDStr, this.currentLayer.layerID );
	desc.putString( krawPixmapFilePathStr, path );
	desc.putBoolean( kboundsStr, true );
	desc.putInteger( kwidthStr, 10000 );
	desc.putInteger( kheightStr, 10000 );
	desc.putInteger( kformatStr, 2 );	// Want raw pixels, not unsupported JPEG
	executeAction( ksendLayerThumbnailToNetworkClientStr, desc, DialogModes.NO );
}

svg.reset();

// Set the current layer to process.  This accepts a layer index number, a DOM layer,
// or an existing PSLayerInfo object.
svg.setCurrentLayer = function( theLayer )
{
	if (typeof theLayer == "number")
		this.currentLayer = new PSLayerInfo( theLayer - cssToClip.documentIndexOffset );
	else
	if ((typeof theLayer == "object") // Check for DOM layer
		&& (typeof theLayer.typename != "undefined")
		&& ((theLayer.typename == "ArtLayer") || (theLayer.typename == "LayerSet")))
		this.currentLayer = new PSLayerInfo( theLayer.itemIndex - cssToClip.documentIndexOffset );
	else
		this.currentLayer = theLayer;	// Existing PSLayerInfo object
}

svg.getLayerAttr = function( keyString, layerDesc )
{
	return this.currentLayer.getLayerAttr( keyString, layerDesc );
}

svg.addText = function( s )
{
	this.svgText += s;
}

// For adding name="value" style parameters.
svg.addParam = function( paramName, value )
{
	this.addText( ' ' + paramName + '="' + value + '"' );
}

svg.pushFXGroup = function( groupParam, groupValue )
{
	this.addText("<g");
	this.addParam( groupParam, groupValue );
	this.addText(">\n");
	this.groupLevel++;
}

svg.popFXGroups = function()
{
	var i;
	if (this.groupLevel > 0)
	{
		for (i = 0; i < this.groupLevel; ++i)
			this.addText("</g>");
		this.addText("\n");
		this.groupLevel = 0;
	}
}

// Definitions (such as linear gradients) must be collected and output ahead
// of the rest of the SVG text.  
svg.addDef = function( s )
{
	this.svgDefs += s;
}

function SavedGradient( info, colorStops, url, minOpacity )
{
	this.info = info;
	this.minOpacity = minOpacity;
	this.colorStops = [];
	// Make an explicit copy, so calls to "reverse" don't hammer the copy
	for (var i in colorStops)
		this.colorStops.push( colorStops[i].copy() );
	this.url = url;
}

SavedGradient.prototype.match = function( info, colorStops )
{
	if ((this.info == info) && (this.colorStops.length == colorStops.length))
	{
		var i;
		for (i in colorStops)
			if (this.colorStops[i] != colorStops[i])
				return false;
		return true;
	}
	return false;
}

// Collect gradient information
svg.getGradient = function( useLayerFX )
{
	// "false" says those defined by layerFX are skipped.
	useLayerFX = (typeof useLayerFX == "undefined") ? false : useLayerFX;
	
	var gradInfo = this.currentLayer.gradientInfo( useLayerFX );
	var colorStops = this.currentLayer.gradientColorStops();
	var gradientURL = null;
	
	function addCoord(coord, v)
	{
		if (v < 0)
			svg.addDef(' ' + coord + '1="' + Math.abs(v) + '%" ' + coord + '2="0%"');
		else
			svg.addDef(' ' + coord + '1="0%" '+coord+'2="' + v + '%"');
	}

	if (gradInfo && colorStops)
	{
		var globalOpacity = gradInfo.opacity;
		// If we've seen this gradient before, just return the URL for it
		for (var i in this.savedGradients)
			if (this.savedGradients[i].match( gradInfo, colorStops ))
				return this.savedGradients[i].url;
				
		// Otherwise, make a new URL and stash it for future reference
		gradientURL = "url(#PSgrad_" + this.gradientID + ")";

		var minOpacity = globalOpacity;
		for (var i in colorStops)
			if (colorStops[i].m/100 < minOpacity)
				minOpacity = colorStops[i].m/100;

		this.savedGradients.push( new SavedGradient( gradInfo, colorStops, gradientURL, minOpacity ) );
		this.gradientDict[gradientURL] = this.savedGradients[this.savedGradients.length-1];

		this.addDef("<" + gradInfo.type + "Gradient " + 'id="PSgrad_' + this.gradientID + '"');
		if (gradInfo.type == "linear")
		{
			// SVG wants the angle in cartesian, not polar, coords. 
			var angle = stripUnits(gradInfo.angle) * Math.PI/180.0;
			var xa=Math.cos(angle)*100, ya=-Math.sin(angle)*100;
			addCoord("x", round1k(xa));
			addCoord("y", round1k(ya));
		}
		this.addDef('>\n');
		
		// reverse is applied only to color values, not stop locations
		
		if (gradInfo.reverse)
			colorStops = GradientStop.reverseStoplist( colorStops );

		var svgStops = []
		for (var c in colorStops)
			svgStops.push( '  <stop offset="' +  Math.round(colorStops[c].location)+ '%"'
									+ ' stop-color="' + colorStops[c].colorString( true )
									+ '" stop-opacity="' + ((colorStops[c].m/100) * globalOpacity) + '" />');
		this.addDef(svgStops.join("\n") + "\n");
		this.addDef("</" + gradInfo.type + "Gradient>\n");
		this.gradientID++;
	}
	return gradientURL;
}

svg.addGradientOverlay = function()
{
	var gradOverlay = this.getLayerAttr("layerEffects.gradientFill");
	
	if (gradOverlay && gradOverlay.getVal("enabled"))
		return this.getGradient( true );	// Explictly ask for layerFX gradient
	return null;
}

// Substitute filter parameters (delimited with $dollar$) using the params dictionary
svg.replaceFilterKeys = function( filterStr, params )
{
	var i, replaceList = filterStr.match(/[$](\w+)[$]/g)
	for (i = 0; i < replaceList.length; ++i)
		filterStr = filterStr.replace( replaceList[i], params[replaceList[i].split('$')[1]] );
	this.addDef( filterStr );
	this.pushFXGroup ('filter',  'url(#' + params.filterTag + ')' );
}

svg.psModeToSVGmode = function( psMode )
{
	var modeMap = { 'colorBurn':null, 'linearBurn':'multiply', 'darkenColor':null,'multiply':'multiply',
							 'lighten':'lighten', 'screen':'screen', 'colorDodge':null, 'linearDodge':'lighten',
							 'lighterColor':'normal', 'normal':'normal', 'overlay':null, 'softLight':null,
							 'hardLight':'normal', 'vividLight':null, 'linearLight':'normal', 'dissolve':null,
							 'pinLight':'normal', 'hardMix':null, 'difference':'lighten', 'exclusion':'lighten',
							 'subtract':null, 'divide':null, 'hue':'normal', 'saturation':null, 'color':'normal',
							 'luminosity':null, 'darken':'darken' };
	return modeMap[psMode];
}

svg.addColorOverlay = function()
{
	var overDesc = this.getLayerAttr("layerEffects.solidFill");
	if (overDesc && overDesc.getVal("enabled"))
	{
		var params = { filterTag: "Filter_" + this.filterID++,
							  color: this.currentLayer.replaceDescKey( 'flood-color="$color$"', overDesc )[1],
							  opacity: round1k( stripUnits( overDesc.getVal("opacity")) / 100.0 ),
							  mode: this.psModeToSVGmode(overDesc.getVal("mode")) };
						  
		if (! params.mode)
			return;			// Bail on unsupported transfer modes
			
		var filterStr =
'<filter id="$filterTag$">\
  <feFlood $color$ flood-opacity="$opacity$" result="floodOut" />\
  <feComposite operator="atop" in="floodOut" in2="SourceGraphic" result="compOut" />\
  <feBlend mode="$mode$" in="compOut" in2="SourceGraphic" />\
</filter>\n'
		this.replaceFilterKeys( filterStr, params );
	}
}

svg.addInnerShadow = function()
{
	var inshDesc = this.getLayerAttr("layerEffects.innerShadow");
	if (inshDesc && inshDesc.getVal("enabled"))
	{
		var mode = this.psModeToSVGmode(inshDesc.getVal("mode"));
		// Some of the PS modes don't do anything with this effect
		if (! mode)
			return;

		var offset = PSLayerInfo.getEffectOffset( inshDesc );
		
		var params = { filterTag: "Filter_" + this.filterID++, 
							  dx: offset[0], dy: offset[1], 
							  blurDist: round1k(Math.sqrt(stripUnits( inshDesc.getVal("blur")))),
							  inshColor: this.currentLayer.replaceDescKey( 'flood-color="$color$"', inshDesc )[1], 
							  opacity: round1k( stripUnits( inshDesc.getVal("opacity")) / 100.0 ), 
							  mode: mode };
		
		var filterStr=
'<filter id="$filterTag$">\
  <feOffset in="SourceAlpha" dx="$dx$" dy="$dy$" />\
  <feGaussianBlur result="blurOut" stdDeviation="$blurDist$" />\
  <feFlood $inshColor$ result="floodOut" />\
  <feComposite operator="out" in="floodOut" in2="blurOut" result="compOut" />\
  <feComposite operator="in" in="compOut" in2="SourceAlpha" />\
  <feComponentTransfer><feFuncA type="linear" slope="$opacity$"/></feComponentTransfer>\
  <feBlend mode="$mode$" in2="SourceGraphic" />\
</filter>\n';
		this.replaceFilterKeys( filterStr, params );
	}
}

// Create drop shadows via SVG filter functions.
svg.addDropShadow = function()
{
	var dsInfo = this.currentLayer.getDropShadowInfo();
	if (dsInfo)
	{
		var strokeWidth = 0;
		var agmDesc = this.currentLayer.getLayerAttr( "AGMStrokeStyleInfo" );
		if (agmDesc && agmDesc.getVal("strokeEnabled")
			&& (strokeWidth = agmDesc.getVal( "strokeStyleLineWidth" )))
		{
			strokeWidth = stripUnits( strokeWidth );
		}

		// Remember, rectangles are [Left, Top, Bottom Right].  Strip the units
		// because SVG chokes on the space between the number and 'px'.  We'll add it back later.
		function rectPx(r) { var i, rpx = []; for (i in r) rpx.push(r[i].as('px')); return rpx; }

		// The filter needs to specify the bounds of the result.
		var fxBounds = rectPx(this.currentLayer.getBounds());

		var params = { filterTag: "Filter_" + this.filterID++, 
							  xoffset: 'x="' + (fxBounds[0] - strokeWidth) + 'px"', 
							  yoffset: 'y="' + (fxBounds[1] - strokeWidth) + 'px"',
							  fxWidth: 'width="' + (fxBounds[2] - fxBounds[0] + strokeWidth) + 'px"',
							  fxHeight: 'height="' + (fxBounds[3] - fxBounds[1] + strokeWidth) + 'px"',
							  dx: dsInfo.xoff, dy: dsInfo.yoff,
							  // SVG uses "standard deviation" vs. pixels for the blur distance; sqrt is a rough approximation
							  blurDist: round1k(Math.sqrt(stripUnits( dsInfo.dsDesc.getVal("blur")))),
							  dsColor: this.currentLayer.replaceDescKey( 'flood-color="$color$"', dsInfo.dsDesc )[1],
							  opacity: round1k( stripUnits( dsInfo.dsDesc.getVal("opacity")) / 100.0 ) };

		// By default, the filter extends 10% beyond the bounds of the object.
		// x, y, width, height need to specify the entire affected region; "userSpaceOnUse" hard codes it to the object's coords
		// feComponentTransfer from (answer comment) http://stackoverflow.com/questions/6088409/svg-drop-shadow-using-css3
		var filterDef =
'<filter filterUnits="userSpaceOnUse" id="$filterTag$" $xoffset$ $yoffset$ $fxWidth$ $fxHeight$  >\
  <feOffset in="SourceAlpha" dx="$dx$" dy="$dy$" />\
  <feGaussianBlur result="blurOut" stdDeviation="$blurDist$" />\
  <feFlood $dsColor$ result="floodOut" />\
  <feComposite operator="atop" in="floodOut" in2="blurOut" />\
  <feComponentTransfer><feFuncA type="linear" slope="$opacity$"/></feComponentTransfer>\
  <feMerge>\n    <feMergeNode/>\n    <feMergeNode in="SourceGraphic"/>\n  </feMerge>\
</filter>\n'
		this.replaceFilterKeys( filterDef, params );
	}
}

svg.addLayerFX = function()
{
	// Gradient overlay layerFX are handled by just generating another copy of the shape
	// with the desired gradient fill, rather than using an SVG filter
	this.addDropShadow();
	this.addInnerShadow();
	this.addColorOverlay();
}

svg.addOpacity = function( combine )
{
	var colorOver = this.getLayerAttr("layerEffects.solidFill.enabled")
	combine = (colorOver || (typeof combine == "undefined")) ? false : combine;
	var fillOpacity = this.getLayerAttr( "fillOpacity" ) / 255;
	// Color overlay replaces fill opacity if it's enabled.
	if (colorOver)
		fillOpacity = this.getLayerAttr("layerEffects.solidFill.opacity");
	var opacity = this.getLayerAttr( "opacity" ) / 255;
	
	if (combine)
	{
		opacity *= fillOpacity;
		if (opacity < 1.0)
			this.addParam( "opacity", round1k(opacity) );
	}
	else
	{
		if (fillOpacity < 1.0) this.addParam( "fill-opacity", round1k(fillOpacity) );
		if (opacity < 1.0) this.addParam( "opacity", round1k(opacity) );
	}
}

//
// Add an attribute to the SVG output.  Note items delimited
// in $'s are substituted with values looked up from the layer data
// e.g.: 
//     border-width: $AGMStrokeStyleInfo.strokeStyleLineWidth$;"
// puts the stroke width into the output.  If the descriptor in the $'s
// isn't found, no output is added.
//
svg.addAttribute = function( attrText, baseDesc )
{
	var result = this.currentLayer.replaceDescKey( attrText, baseDesc );
	var replacementFailed = result[0];
	attrText = result[1];
	
	if (! replacementFailed)
		this.addText( attrText );
	return !replacementFailed;
}

// Text items need to try the base, default and baseParentStyle descriptors
svg.addAttribute2 = function( attrText, descList )
{
	var i = 0;
	while ((i < descList.length) && (!descList[i] || ! this.addAttribute( attrText, descList[i] )))
		i += 1;
}

svg.getVal2 = function( attrName, descList )
{
	var i = 0;
	var result = null;
	while ((i < descList.length) && ((! descList[i]) || !(result = descList[i].getVal( attrName ))))
		i += 1;

	return result;
}

// Process shape layers
svg.getShapeLayerSVG = function()
{
	var agmDesc = this.currentLayer.getLayerAttr( "AGMStrokeStyleInfo" );
	var capDict = {"strokeStyleRoundCap":'round', "strokeStyleButtCap":'butt',
						"strokeStyleSquareCap":'square'};
	var joinDict = {"strokeStyleBevelJoin":'bevel', "strokeStyleRoundJoin":'round',
						"strokeStyleMiterJoin":'miter'};
					
	function hasStroke() {
		return (agmDesc && agmDesc.getVal("strokeEnabled"));
	}
					
	function addStroke() {
		if (hasStroke())
		{
			svg.addAttribute( ' stroke="$strokeStyleContent.color$"', agmDesc );
			svg.addAttribute( ' stroke-width="$strokeStyleLineWidth$"', agmDesc );
			var dashes = agmDesc.getVal( "strokeStyleLineDashSet", false );
			if (dashes && dashes.length)
			{
				var strokeWidth = stripUnits(agmDesc.getVal("strokeStyleLineWidth"));
				// Patch the "[0,2]" dash pattern from the default dotted style, else the stroke
				// vanishes completely.  Need to investigate further someday.
				if ((dashes.length == 2) && (dashes[0] == 0) && (dashes[1] == 2))
					dashes = [strokeWidth/2, strokeWidth*2];
				else
					for (var i in dashes)
						dashes[i] = dashes[i] * strokeWidth;
				svg.addParam( 'stroke-dasharray', dashes.join(", ") );
			}
			
			var cap = agmDesc.getVal("strokeStyleLineCapType");
			if (cap)
				svg.addParam('stroke-linecap', capDict[cap]);

			var join = agmDesc.getVal("strokeStyleLineJoinType");
			if (join)
				svg.addParam('stroke-linejoin', joinDict[join]);
		}

		// Check for layerFX style borders
		var fxDesc = svg.getLayerAttr( "layerEffects.frameFX" );
		if (fxDesc && fxDesc.getVal( "enabled" ) 
			&& (fxDesc.getVal( "paintType" ) == "solidColor"))
		{
			svg.addAttribute(" stroke-width=$strokeStyleLineWidth$", fxDesc );
			svg.addAttribute(" stroke=$strokeStyleContent.color$", fxDesc );
		}
	}

	// Layer fx need to happen first, so they're defined in enclosing groups
	this.addLayerFX();
	var gradOverlayID = this.addGradientOverlay();

	// For now, Everything Is A Path.  We'll revisit this when shape meta-data is available.
	this.addText("<path");
	
	// If there's a gradient overlay effect, the stroke must be added there.
	if (! gradOverlayID)
		addStroke();

	this.addOpacity();

	var gradientID = this.getGradient();
	if (!agmDesc || (agmDesc && agmDesc.getVal("fillEnabled")))
	{
		if (gradientID)
			this.addParam('fill', gradientID);
		else
			this.addAttribute(' fill="$adjustment.color$"' );
	}
	else
		this.addAttribute(' fill="none"' );

	this.addText('\n d="' + this.getLayerAttr("layerVectorPointData") + '"');
	this.addText('/>\n');
	this.popFXGroups();
	
	if (gradOverlayID)
	{
		this.addText("<path");
		addStroke();
		this.addParam('fill', gradOverlayID);
		this.addText('\n d="' + this.getLayerAttr("layerVectorPointData") + '"');
		this.addText('/>\n');
	}		
	
	// A solid fill layerFX trashes the stroke, so we over-write it with one outside of the solidFill layer effect group
	if (!gradOverlayID && this.getLayerAttr("layerEffects.solidFill.enabled") && hasStroke())
	{
		this.addText('<path fill="none"');
		addStroke();
		this.addText('\n d="' + this.getLayerAttr("layerVectorPointData") + '"');
		this.addText('/>\n');
	}
}

// This works for solid colors and gradients; other stuff, not so much
svg.getAdjustmentLayerSVG = function()
{
	// Layer fx need to happen first, so they're defined in enclosing groups
	this.addLayerFX();
	var gradOverlayID = this.addGradientOverlay();

	var self= this;
	function addRect()
	{
		self.addText("<rect ");
		self.addAttribute( 'x="$left$" y="$top$" width="$width$" height="$height$" ',
								self.getLayerAttr("bounds") );
	}

	addRect();
	this.addOpacity();

	var gradientID = this.getGradient();
	if (gradientID)
		this.addParam('fill', gradientID);
	else
		this.addAttribute(' fill="$adjustment.color$"' );
	this.addText("/>\n");

	this.popFXGroups();
	
	if (gradOverlayID)
	{
		addRect();	// Add another rect with the gradient overlay FX
		this.addParam('fill', gradOverlayID);
		this.addText('\n d="' + this.getLayerAttr("layerVectorPointData") + '"');
		this.addText('/>\n');
	}		
}

svg.getTextLayerSVG = function()
{
	var gradientURL = this.getGradient( true );
	
	if (gradientURL)
	{
		var minOpacity = this.gradientDict[gradientURL].minOpacity;
		this.getTextLayerSVG1( gradientURL );
		if (this.getLayerAttr("layerEffects.gradientFill") && (minOpacity < 1))
			this.getTextLayerSVG1();	// We need the base color as well
	}
	else
		this.getTextLayerSVG1();
}	

// Text; just basic functionality for now; paragraph style text is not handled yet.
svg.getTextLayerSVG1 = function( fillColor )
{
	function isStyleOn( textDesc, styleKey, onText )
	{
		var styleText = textDesc.getVal( styleKey );
		return (styleText && (styleText.search( onText ) >= 0));
	}

	var textDesc = this.getLayerAttr( "textKey.textStyleRange.textStyle" );
	var leftMargin = "0";
	var textBottom = "0";
	var textDescList = [textDesc];
	var defaultDesc = this.getLayerAttr( "textKey.paragraphStyleRange.paragraphStyle.defaultStyle" );
	textDescList.push( defaultDesc );
	var baseParentDesc = textDesc.getVal('baseParentStyle');
	textDescList.push( baseParentDesc );

	if (textDesc)
	{
		this.addLayerFX();
		this.addText('<text');
		var boundsDesc = this.getLayerAttr( "boundsNoEffects" );
		if (textDesc.getVal("autoKern") == "metricsKern")
			this.addText( ' kerning="auto"' );
		this.addAttribute2(' font-family="$fontName$"', textDescList )
		if (typeof fillColor == "undefined")
			this.addAttribute(' fill="$color$"', textDesc );
		else
			this.addParam('fill', fillColor );
		this.addOpacity();
		
		var transformMatrixUsed = false;
		var textXform = this.getLayerAttr( "textKey.transform" );
		// Accomodate PS text baseline for vertical position
		if (textXform)
		{
			function xfm(key) { return textXform.getVal( key ); }
			var xx=xfm("xx"), xy=xfm("xy"), yx=xfm("yx"), yy=xfm("yy"), tx=xfm("tx"), ty=xfm("ty");
			
			// Check to make sure it's not an identity matrix
			if (! ((xx==1) && (xy==0)  && (yx==0) && (yy==1) && (tx==0) && (ty==0)))
			{
				// "boundsDesc" is the bounding box of the transformed text (in doc coords)
				// Original (untransformed, untranslated) text bounding box
				var originalTextBounds =this.getLayerAttr("textKey.boundingBox");
				function midval( key0, key1, desc, op ) 
				{ return op(stripUnits( desc.getVal( key0 ) ), stripUnits( desc.getVal( key1 )))/2.0; }
				// Find the vector representing the bottom left corner of
				// the original (untransformed) text bounds centered on the origin
				var obx = -midval( "left", "right", originalTextBounds, function(a,b) { return b-a;} );
				var oby = midval( "top", "bottom", originalTextBounds, function(a,b) { return -b-a;} );
				// Transform the vector by the matrix
				var tbx = obx * xx + oby * yx + tx;
				var tby = obx * xy + oby * yy + ty;
				// Now find the center of the transformed text:
				var cbx = midval( "left", "right", boundsDesc, function(a,b) { return a+b;} );
				var cby = midval( "top", "bottom", boundsDesc, function(a,b) { return a+b;} );
				// Offset the transformed bottom left corner vector by
				// the center of the transformed text bounds in Photoshop:
				tbx += cbx;
				tby += cby;
				// These values become the translate values in the SVG matrix:
				this.addAttribute( ' transform="matrix( $xx$, $xy$, $yx$, $yy$,', textXform );
				this.addText( tbx + ", " + tby + ')"' );
				transformMatrixUsed = true;
			}
		}
		
		if (! transformMatrixUsed)
		{
			textBottom = stripUnits(boundsDesc.getVal("bottom"));
			leftMargin = boundsDesc.getVal('left');	// For multi-line text
		}

		// This table is: [PS Style event key ; PS event value keyword to search for ; corresponding SVG]
		var styleTable = [["fontStyleName",		"Bold",				' font-weight="bold"'],
								["fontStyleName",		"Italic",				' font-style="italic"'],
								["strikethrough",		"StrikethroughOn",	' text-decoration="line-through"'],
								["underline",				"underlineOn",	 ' text-decoration="underline"'],
								 // Need RE, otherwise conflicts w/"smallCaps"
//								["fontCaps",				/^allCaps/,		 	"text-transform: uppercase;"], 
								["fontCaps",				"smallCaps",		 ' font-variant="small-caps"'],
								// These should probably also modify the font size?
								["baseline",				"superScript",	 	' baseline-shift="super"'],
//								["baseline",				"subScript",			' baseline-shift="sub"']
								];

		var i;
		for (i in styleTable)
			if (isStyleOn( textDesc, styleTable[i][0], styleTable[i][1] ))
				this.addText( styleTable[i][2] );
				
		var fontSize = stripUnits(this.getVal2( "size", textDescList ));
		var fontLeading = textDesc.getVal( "leading" );
		fontLeading = fontLeading ? stripUnits( fontLeading ) : fontSize;

		if (isStyleOn( textDesc, "baseline", "subScript" ))
		{
			fontSize = fontSize / 2;
			textBottom += fontLeading;
		}

		this.addParam( 'font-size', fontSize + 'px' );
		if (! transformMatrixUsed)
		{
			this.addParam( 'x', leftMargin );
			this.addParam( 'y', textBottom + 'px' );
		}
		this.addText('>');

		var textStr = this.getLayerAttr('textKey').getVal('textKey');

		// SVG doesn't have native support for all caps
		if (isStyleOn( textDesc, "fontCaps", /^allCaps/ ))
			textStr = textStr.toUpperCase();
			
		// Weed out < > & % @ ! # etc.
		textStr = this.HTMLEncode( textStr );

		// If text is on multiple lines, break it into separate spans.
		if (textStr.search(/\r/) >= 0)
		{
			// Synthesize the line-height from the "leading" (line spacing) / font-size
			var lineHeight = "1.2em";
			if (fontSize && fontLeading)
			{
				// Strip off the units; this keeps it as a relative measure.
				leadingOffset = fontLeading;
				lineHeight = round1k(fontLeading / fontSize);
			}
		
			var topOffset = "";
			if (! transformMatrixUsed)
//				topOffset = ' dy="-' + (textStr.match(/\r/g).length * lineHeight) + 'em"';
				 topOffset = ' dy="-' + stripUnits(this.getLayerAttr("textKey.boundingBox.bottom")) + 'px"';

			var textSpans = ' <tspan' + topOffset + '>';

			textSpans += textStr.replace(/\r/g, '</tspan><tspan x="' + leftMargin + '" dy="' + lineHeight + 'em">');
			textSpans +='</tspan>\n';
			// Blank lines must have at least a space or else dy is ignored.
			textSpans = textSpans.replace(/><\/tspan>/g, "> </tspan>");
			this.addText( textSpans );
		}
		else
			this.addText( textStr );
		this.addText('</text>\n');
		this.popFXGroups();
	}
}

// Generate a file reference if the layer ends in an image-file suffix (return true)
// Otherwise, return false.
svg.getImageLayerFileRefSVG = function()
{
	var validSuffix = {'.tiff':1, '.png':1, '.jpg':1, '.gif':1};
	
	// Apply generator's naming rules to the image names.  
	// If there's a list, just grab the first.
	var name = this.getLayerAttr("name").split(",")[0];
	
	var suffix = (name.lastIndexOf('.') >= 0) 
					? name.slice( name.lastIndexOf('.') ).toLowerCase() : null;
	suffix = (validSuffix[suffix]) ? suffix : null;
	if (! suffix)
		return false;

	this.addParam( 'xlink:href', name );
	return true;
}

// Write layer pixels as in-line PNG, base64 encoded.
svg.getImageLayerSVGdata = function()
{
	var pngPath = File(Folder.temp + "/png4svg" + this.currentLayer.layerID).fsName;
	this.writeLayerPNGfile( pngPath );

	var pngFile = new File( pngPath +".png" );
	pngFile.open('r');
	pngFile.encoding = "BINARY";
	var pngData64 = this.encodeBase64( pngFile.read() );
	pngFile.close();
	pngFile.remove();
	this.addParam( 'xlink:href', "data:img/png;base64," + pngData64 );
}

svg.getImageLayerSVG = function()
{
	var boundsDesc = this.currentLayer.getLayerAttr( "bounds" );
	
	this.addText( "<image " );

	this.addOpacity( true );
	var i, boundList = [' x="$left$"', ' y="$top$"', ' width="$width$"', ' height="$height$" '];
	for (i in boundList) this.addAttribute( boundList[i], boundsDesc );
	// If the image doesn't have a file suffix, then generate the output as in-line data.
	if (! this.getImageLayerFileRefSVG())
		this.getImageLayerSVGdata();
	this.addText(" />\n");
}

// This walks the group and outputs all items in that group.  If the current layer
// is not a group, then it walks to the end of the document (i.e., for dumping
// the whole document).
svg.getGroupLayerSVG = function( processAllLayers )
{
	function isSVGLayerKind( kind )
	{
		return (cssToClip.isCSSLayerKind( kind ) || (kind == kAdjustmentSheet));
	}

	processAllLayers = (typeof processAllLayers == "undefined") ? false : processAllLayers;
	// If processing all of the layers, don't stop at the end of the first group
	var layerLevel = processAllLayers ? 2 : 1;
	var visibleLevel = layerLevel;
	var i, curIndex = this.currentLayer.index;	
	if (this.currentLayer.layerKind == kLayerGroupSheet)
	{
		if (! this.currentLayer.visible)
			return;
		curIndex--; // Step to next layer in group so layerLevel is correct
	}

	var groupLayers = [];
	while ((curIndex > 0) && (layerLevel > 0))
	{
		var nextLayer = new PSLayerInfo( curIndex, false );
		if (isSVGLayerKind( nextLayer.layerKind ))
		{
			if (nextLayer.layerKind == kLayerGroupSheet)
			{
				if (nextLayer.visible && (visibleLevel == layerLevel))
					visibleLevel++;
				layerLevel++;
			}
			else
			{
				if (nextLayer.visible && (visibleLevel == layerLevel))
					groupLayers.push( nextLayer );
			}
		}
		else
		if (nextLayer.layerKind == kHiddenSectionBounder)
		{
			layerLevel--;
			if (layerLevel < visibleLevel)
				visibleLevel = layerLevel;
		}
		curIndex--;
	}

	for (i = groupLayers.length-1; i >= 0; --i)
		this.processLayer( groupLayers[i] );
}	

svg.processLayer = function( layer )
{
	this.setCurrentLayer( layer );

	switch (this.currentLayer.layerKind)
	{
	case kVectorSheet:		this.getShapeLayerSVG();	return true;
	case kTextSheet:		this.getTextLayerSVG();		return true;
	case kPixelSheet:		this.getImageLayerSVG();	return true;
	case kAdjustmentSheet:	this.getAdjustmentLayerSVG(); return true;
	case kLayerGroupSheet:	this.getGroupLayerSVG();	return true;
	}
	return false;
}

// Save & restore the units (also stash benchmark timing here)
svg.pushUnits = function() 
{
	this.saveUnits = app.preferences.rulerUnits;
	app.preferences.rulerUnits = Units.PIXELS;	// Web dudes want pixels.
	this.startTime = new Date();
}

svg.popUnits = function()
{
	if (this.saveUnits) 
		app.preferences.rulerUnits = this.saveUnits;
	var elapsedTime = new Date() - this.startTime;
	return ("time: " + (elapsedTime / 1000.0) + " sec");
}

svg.layerSVGdata = function( layerID )
{
	svg.reset();
	this.pushUnits();
	svg.processLayer( PSLayerInfo.layerIDToIndex( layerID ) );
	var time = this.popUnits();
	// JSONify the output
	return  "{ svgHeader:" + this.jsquote( this.svgDefs ) + ", svgText:" + this.jsquote( this.svgText ) + " }";
} 

// SVG: Stuff after is piled on top of stuff before.
svg.createSVGfile = function( f, layerList, objScale )
{
	var i;
	svg.reset();
	var elapsedTime;
	this.pushUnits();
	
	if (typeof objScale == "undefined")
		objScale = 1;

	if (typeof layerList == "object")
		for (i in layerList)
			svg.processLayer(  layerList[i] );
	else
	{
		svg.setCurrentLayer( cssToClip.getDocAttr("numberOfLayers") + cssToClip.documentIndexOffset );
		// Use the group as a way to walk the entire document.
		svg.getGroupLayerSVG( true );
	}

	elapsedTime = this.popUnits();
	
	f.encoding = "UTF-8";	// Must match the SVG header
	f.open('w');
	f.write(this.svgHeader);

	if (svg.svgDefs.length > 0)
		f.writeln("<defs>\n" + svg.svgDefs + "\n</defs>");
	if (objScale != 1)
		f.writeln('<g transform="scale(' + round1k( objScale ) + ')" >');
	f.writeln(svg.svgText);
	if (objScale != 1)
		f.writeln('</g>');
	f.writeln("</svg>");
	f.close();

	// We can watch this in ESTK without screwing up the app
	return elapsedTime;
}

svg.addSVGsuffix = function( name )
{ 
	// Weed out non-word characters a la plugins/assets.generate/index.js:normalizeFilename(),
	// but do it carefully so the ".svg" suffix doesn't get mauled.
	var suffix = (name.lastIndexOf('.') >= 0) 
					? name.slice( name.lastIndexOf('.') ).toLowerCase() : null;
	var base = (suffix==".svg") ? name.slice( 0, name.lastIndexOf('.') ) : name;
	base = base.replace(/[^A-Za-z0-9]/g, '_');
	return base + ".svg";
}

// Get the folder for this document, or the generic generator folder if the doc
// isn't saved yet.
svg.getDocumentFolder = function()
{
	var genFolder, name;
	try {
		genFolder = app.activeDocument.fullName.parent;
		name = app.activeDocument.fullName.name;
		if (name.lastIndexOf('.') >= 0)
			name = name.slice(0, name.lastIndexOf('.'));
	}
	catch (err) {
//		if (err.number !== 8103)  // It should be this error number if the doc's not saved
		genFolder = Folder("~/Desktop/generator");
		if (! genFolder.exists)
			genFolder.create();
		name = app.activeDocument.name;
	}

	genFolder += "/" + name + "-assets/";
	if (! Folder(genFolder).exists)
		Folder(genFolder).create()

	return genFolder;
}

// Front-end to above, creating output in Generator's folder for the document.
// This creates a file for a single SVG layer.
svg.generateFileByIndex = function( layerIndex, layerFilename, objScale )
{
	var genFolder = this.getDocumentFolder();
	this.setCurrentLayer( layerIndex );
	if (typeof layerFilename == "undefined")
		layerFilename = this.addSVGsuffix( this.currentLayer.getLayerAttr( 'name' ) );
	this.createSVGfile( File( genFolder + layerFilename ), [layerIndex], objScale );
}

svg.generateFileByID = function( layerID, layerFilename, objScale )
{
	var layerIndex = PSLayerInfo.layerIDToIndex( layerID );
	this.generateFileByIndex( layerIndex, layerFilename, objScale );
}

// This creates an SVG file for all the layers in the document.
svg.generateDocumentFile = function()
{
	var name;
	try {
		name = app.activeDocument.fullName.name;
	}
	catch (err)
	{
		alert(localize("$$$/Photoshop/ConvertSVG/MustSave=Document must be saved first."));
		return null;
	}
	
	// Remove the previous suffix (e.g., ".psd")
	if (name.lastIndexOf('.') >= 0)
		name = name.slice(0, name.lastIndexOf('.'));
	
	// If a Generator-style assets folder exists, save the file there.
	var folder = app.activeDocument.fullName.parent;
	if (Folder(folder + "/" + name).exists)
		folder += ("/" + name);

	name += ".svg";
	
	var svgFile = File( folder + "/" + name );

	return svg.createSVGfile( svgFile );
}

////////////////////////////////////////////////////////////////////////////////////////////////////////
// Test and debug code
////////////////////////////////////////////////////////////////////////////////////////////////////////

function testSVGgenLayerIndexList()
{
	return svg.generateFile( [3,4] );
}

function testlayerSVGdata()
{
	return svg.layerSVGdata( app.activeDocument.activeLayer.id );
}

function testSVGActiveLayer()
{
	// Convert active layer to SVG
	var layerName = svg.addSVGsuffix( app.activeDocument.activeLayer.name );
	var folderName = app.activeDocument.fullName.toString();
	var dotPos = folderName.lastIndexOf('.');
	var folderPath = ((dotPos >= 0) ? folderName.slice(0, dotPos) : folderName) + "-assets/";
	if (! Folder(folderPath).exists)
		folderPath = app.activeDocument.fullName.parent + "/";
	return svg.createSVGfile( File( folderPath + layerName ),
									[app.activeDocument.activeLayer] );
}

function dumpLayers()
{
	var i, numLayers = cssToClip.getDocAttr("numberOfLayers") + cssToClip.documentIndexOffset;
	var layerKindNames = ["Any", "Pxl", "Adj", "Txt", "Vec", "SmO", "Vid", "Grp", "3DS", "Grd", "Ptn", "Sld", "Bgd", "Bnd"];
	
	$.writeln("# of layers: " + numLayers);
	for (i = 1; i <= numLayers; ++i)
	{
		svg.setCurrentLayer( i );
		var name = svg.getLayerAttr( "name" );
		var id = svg.getLayerAttr( "layerID" );
		var kind = svg.getLayerAttr( "layerKind" );
		$.writeln("Layer[" + i + "] ID=" + id + " <" + layerKindNames[kind] +"> '" + name + "'" );
	}
}

//svg.generateFileByID( app.activeDocument.activeLayer.id );  // Call used by Generator
//dumpLayers();
//testlayerSVGdata();
//testSVGgenLayerIndexList();
//testSVGActiveLayer();
//svg.generateDocumentFile();
//cssToClip.dumpLayers();
