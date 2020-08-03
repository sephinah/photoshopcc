////////////////////////////////////////////////////////////////////////////
// ADOBE SYSTEMS INCORPORATED
// Copyright 2010 Adobe Systems Incorporated
// All Rights Reserved

// NOTICE:  Adobe permits you to use, modify, and distribute this file in accordance with the
// terms of the Adobe license agreement accompanying it.  If you have received this file from a
// source other than Adobe, then your use, modification, or distribution of it requires the prior
// written permission of Adobe.

// Adobe Photoshop QE / DI Pro Tools Team
// Email: DL-PS-External-Bugs-Tools@adobe.com
// Script File: MigrateAllPresets.jsx
// Script Dev: Kaori Mikawa, Barkin Aygun
// Script QE: Kyoko Itoda, Irina Satanovskaya

// This script carries over your presets and workspaces files from CS6, CS5.1, CS5, CS4 and CS3 in order,
// not picking up already existing ones. 
// It does it quietly, and within Photoshop, is designed to run in first launch
/////////////////////////////////////////////////////////////////////////////
/*
// BEGIN__HARVEST_EXCEPTION_ZSTRING
<javascriptresource>
<name>$$$/JavaScripts/MigratePresets/Menu=Migrate Presets...</name>
<menu>help</menu>
</javascriptresource>
// END__HARVEST_EXCEPTION_ZSTRING
*/
#target photoshop;
$.localize = true;

try{ 
    app.bringToFront();
    app.displayDialogs = DialogModes.NO;
    
    var migrationComplete = false;
    var errorToQuit;
    
    var versionstrs = new Array("CS6", "CS5.1", "CS5", "CS4", "CS3");
    var versionflags = new Array();
    for (i = 0; i < versionstrs.length; i++) {
            versionflags.push(false);
    }
    
    var activesetfiles = new Array("Brushes.psp","Swatches.psp","Gradients.psp",
    							"Styles.psp","Patterns.psp","Contours.psp",
    							"CustomShapes.psp","Actions Palette.psp",
    							"ToolPresets.psp","Default Type Styles.psp");
    
    //ZSTRING
    var titleFileMigration = localize("$$$/MigratePresets/DialogTitle=Migrate Presets");
    var msgCompleteError = localize("$$$/MigratePresets/MessageError=An error occurred when migrating the presets. Preset migration failed.");
    var msgAdmin = localize("$$$/MigratePresets/MessageAdmin=Administrative privileges are required to migrate these presets.");
    var msgWrongVersion = localize("$$$/MigratePresets/MessageWrongVersion=This script is intended for Photoshop CC. Launch Photoshop CC and try again.");
    var noFileSelected = localize("$$$/MigratePresets/MessageNoFile=No file is selected to migrate.");
    var msgMigrate =localize("$$$/MigratePresets/MessageConfirm=Would you like to migrate presets from the following versions?^n");
    var titleConfirmDialog = localize("$$$/MigratePresets/ConfirmTitle=Migrate Presets From Previous Versions of Adobe Photoshop");
    var refreshProgressText = localize("$$$/MigratePresets/MessageRefresh=Preparing files for migration...");
    
    var curOS = getCurOS($.os);
    var appVer = getAppVer();
    var dirCommonFiles = getDirCommonFiles(); 
    var dirUserData = getDirUserData();
    var dirUserPreferencesMac = getDirUserPreferencesMac();
    
    var dirUserPresets = new Folder(dirUserData + "/Adobe/Adobe Photoshop CC/Presets");
	var dirUserSettings = new Folder();
    var dirUserWorkspaces = new Folder();
    var dirUserWorkspacesModified = new Folder();
    if(curOS.match("mac")){
    	dirUserSettings = new Folder(dirUserPreferencesMac + "/Adobe Photoshop CC Settings");
        dirUserWorkspaces = new Folder(dirUserPreferencesMac + "/Adobe Photoshop CC Settings/WorkSpaces");
        dirUserWorkspacesModified = new Folder(dirUserPreferencesMac + "/Adobe Photoshop CC Settings/WorkSpaces (Modified)");
    }else{
    	dirUserSettings = new Folder(dirUserData + "/Adobe/Adobe Photoshop CC/Adobe Photoshop CC Settings");
        dirUserWorkspaces = new Folder(dirUserData + "/Adobe/Adobe Photoshop CC/Adobe Photoshop CC Settings/WorkSpaces");
        dirUserWorkspacesModified = new Folder(dirUserData + "/Adobe/Adobe Photoshop CC/Adobe Photoshop CC Settings/WorkSpaces (Modified)");
    }
   
    var fileItems = new Array();
    var fileToMigrate = new Array();
    var objFolderName = "";
        
    // -----------------------------------------
    // User Presets
    // -----------------------------------------
    var arrayUserFolderPresetsTo = new Array();
    var arrayUserFolderPresetsFrom = new Array();
    var arrayUserFolderPresetsDiff = new Array();
    var arrayUserFolderPresetsDiffDont = new Array();
    var userFolderPresetsDiffTotal = 0;
    // -----------------------------------------
    // User Workspaces
    // -----------------------------------------
    var arrayUserFolderWorkspacesTo = new Array();
    var arrayUserFolderWorkspacesFrom = new Array();
    var arrayUserFolderWorkspacesDiff = new Array();
    var arrayUserFolderWorkspacesDiffDont = new Array();
    var userFolderWorkspacesDiffTotal = 0;
    // -----------------------------------------
    // User Workspaces
    // -----------------------------------------
    var arrayUserFolderWorkspacesModifiedTo = new Array();
    var arrayUserFolderWorkspacesModifiedFrom = new Array();
    var arrayUserFolderWorkspacesModifiedDiff = new Array();
    var arrayUserFolderWorkspacesModifiedDiffDont = new Array();
    var userFolderWorkspacesModifiedDiffTotal = 0;
    // -----------------------------------------
    // Settings
    // -----------------------------------------
	var arraySettingsTo = new Array();
	var arraySettingsFrom = new Array();
	var arraySettingsDiff = new Array();
	var arraySettingsDiffDont = new Array();
	var userFolderSettingsDiffTotal = 0;
	
    var result = "success";
    
    if (checkMigrateIsNecessary()) {
        if(appVer == 14){
            for (i = 0; i < versionstrs.length; i++){
                if (versionflags[i] == true) {
                    msgMigrate = msgMigrate + "Adobe Photoshop " + versionstrs[i] +"\n";
                } 
            }
            if (confirm(msgMigrate, false, titleConfirmDialog)) {
            	for (i = 0; i < versionstrs.length; i++) {
	            	if (versionflags[i] == true) {
	            		migrateAll(versionstrs[i]);
	            	}
	            }
        	} else {
        		result = "failure";
        	}
        }else{
            alert(msgWrongVersion, titleFileMigration);
        }
    } else {
        result = "nothing";
    }// else die quietly, since there is nothing to do
    result;
        
}catch(e){
	alertScriptError("Line: " + e.line +" - "+ e);
}

/****************************************
 * checkMigrateIsNecessary
 ****************************************/
function checkMigrateIsNecessary()
{
    var migrateNecessary= false;
    for (i = 0; i < versionstrs.length; i++){
        refreshDiffData(versionstrs[i], true);
        if (arrayUserFolderPresetsDiff.length == 0 && 
        	arrayUserFolderWorkspacesDiff.length == 0 &&
        	arrayUserFolderWorkspacesModifiedDiff.length == 0 &&
        	arraySettingsDiff.length == 0) {
            versionflags[i] = false;
        } else {
            versionflags[i] = true;
            migrateNecessary = true;
            break; // this should break at first possible sync
        }
    }
    return migrateNecessary;
}

/****************************************
 * migrateAll
 ****************************************/
function migrateAll(versionstr){
  	var winProgBar = new Window("palette", titleFileMigration); 
    winProgBar.progBarLabel = winProgBar.add("statictext", [20, 20, 320, 35], refreshProgressText);
    winProgBar.center();
    winProgBar.show();
 
    refreshDiffData(versionstr, false);
    winProgBar.close();
	if (arrayUserFolderPresetsDiff.length == 0 && 
    	arrayUserFolderWorkspacesDiff.length == 0 &&
        arrayUserFolderWorkspacesModifiedDiff.length == 0 &&
        arraySettingsDiff.length == 0) {
        return;
    }
    migrateFiles(arrayUserFolderPresetsDiff, versionstr);
    migrateFiles(arrayUserFolderWorkspacesDiff, versionstr);
    migrateFiles(arrayUserFolderWorkspacesModifiedDiff, versionstr);
    migrateFiles(arraySettingsDiff, versionstr);
}


/****************************************
 * refreshListBoxes
 ****************************************/
function refreshDiffData(versionstr, justCheck){
    dirUserPresetsFrom = new Folder(dirUserPresets.toString().replace(/CC/g,versionstr));
    dirUserWorkspacesFrom = new Folder(dirUserWorkspaces.toString().replace(/CC/g,versionstr));
    dirUserWorkspacesModifiedFrom = new Folder(dirUserWorkspacesModified.toString().replace(/CC/g,versionstr));
    dirUserSettingsFrom = new Folder(dirUserSettings.toString().replace(/CC/g,versionstr));
   
	// -----------------------------------------
	// Settings Files
	// -----------------------------------------
     if (dirUserSettingsFrom.exists)
   	{
		arraySettingsTo = getSettingsContents(dirUserSettings);
		arraySettingsFrom = getSettingsContents(dirUserSettingsFrom)
		arraySettingsDiff = getMissingFiles(arraySettingsFrom, arraySettingsTo);
		arraySettingsDiffDont = new Array();
		if (arraySettingsDiff.length > 0 && justCheck)
			return;
		}
	else
		{
		// if settings folder for an app does not exist, we shouldn't check the other folders as that app isn't "installed"
			return;
		}
		
    // -----------------------------------------
    // User Workspaces
    // -----------------------------------------
	if (dirUserWorkspacesFrom.exists)
		{
		arrayUserFolderWorkspacesTo = getDirContents(dirUserWorkspaces.getFiles());
		arrayUserFolderWorkspacesFrom = getDirContents(dirUserWorkspacesFrom.getFiles());
		arrayUserFolderWorkspacesDiff = getMissingFiles(arrayUserFolderWorkspacesFrom,arrayUserFolderWorkspacesTo);
		arrayUserFolderWorkspacesDiffDont = new Array();
		if (arrayUserFolderWorkspacesDiff.length > 0 && justCheck)
			return;
    	}

    // -----------------------------------------
    // User Workspaces (Modified)
    // -----------------------------------------
	if (dirUserWorkspacesModifiedFrom.exists)
		{
		arrayUserFolderWorkspacesModifiedTo = getDirContents(dirUserWorkspacesModified.getFiles());
		arrayUserFolderWorkspacesModifiedFrom = getDirContents(dirUserWorkspacesModifiedFrom.getFiles());
		arrayUserFolderWorkspacesModifiedDiff = getMissingFiles(arrayUserFolderWorkspacesModifiedFrom,arrayUserFolderWorkspacesModifiedTo);
		arrayUserFolderWorkspacesModifiedDiffDont = new Array();
		if (arrayUserFolderWorkspacesModifiedDiff.length > 0 && justCheck)
			return;
    	}

    // -----------------------------------------
    // User Presets
    // -----------------------------------------
    if (dirUserPresetsFrom.exists)
    	{
		arrayUserFolderPresetsTo = getDirContents(dirUserPresets.getFiles());  
		arrayUserFolderPresetsFrom = getDirContents(dirUserPresetsFrom.getFiles()); 
		arrayUserFolderPresetsDiff = getMissingFiles(arrayUserFolderPresetsFrom,arrayUserFolderPresetsTo);
		arrayUserFolderPresetsDiffDont = new Array();
		if (arrayUserFolderPresetsDiff.length > 0 && justCheck)
			return;
    	}
}

/****************************************
 * migrateFiles
 ****************************************/
function migrateFiles(filesToMigrate, versionstr){
    //quietly return if there is nothing to migrate
    if(filesToMigrate.length == 0){
        return;
    }
    
    var migrationRes = showProgress();
    if(!migrationRes){
        alert(msgCompleteError, titleFileMigration, true);
    }

    function showProgress(){
        try{
            var winProgBar = new Window("palette", titleFileMigration); 
            winProgBar.progBarLabel = winProgBar.add("statictext", [20, 20, 320, 35], titleFileMigration);
            winProgBar.center();
            winProgBar.show();
 
            for(var i=0; i<filesToMigrate.length;i++){
                var targetFolder = Folder(filesToMigrate[i][1].parent.toString().replace(RegExp(versionstr, "gi"),"CC"));
                var targetFile = targetFolder+"/"+filesToMigrate[i][1].name;   
                winProgBar.progBarLabel.text = decodeURI(filesToMigrate[i][0]) + "/" + decodeURI(filesToMigrate[i][1].name);
                if(!targetFolder.exists){
                    var createFolder = targetFolder.create();
                }
                if(targetFolder.exists){
                    var fileCopy = filesToMigrate[i][1].copy(targetFile);
                    if(filesToMigrate[i][0] == "Actions"){
                        load(File(targetFile));
                    }
                }
                if(!fileCopy || !File(targetFile).exists){
                    alertScriptError(localize("$$$/MigratePresets/MessageCopyFail2=An error occurred while migrating the file: ") + decodeURI(filesToMigrate[i][1].name) + "(" + filesToMigrate[i][1].error + ")" );
                }
             }
            winProgBar.close();
            return true;
        }catch(e){
            alertScriptError("Line: " + e.line +" - "+ e);
        }
    }
}


/****************************************
 * getMissingFiles
 ****************************************/
function getMissingFiles(fromArray,toArray) {
    var diffItems = new Array();
    try{
        for(var x=0;x<fromArray.length;x++){
            if(!include(toArray,fromArray[x][1].name)){
                diffItems.push(fromArray[x]);
            }
        }
    }catch(e){
        alertScriptError(y + "Line: " + e.line +" - "+ e);
    }
    return diffItems;
}

function include(arr, obj) {
  for(var i=0; i<arr.length; i++) {
    if (arr[i][1].name.toLowerCase() == obj.toLowerCase()) return true;
  }
}

/****************************************
 * getSettingsContents
 ****************************************/
function getSettingsContents(settingFolder) {
	settingsItems = new Array();
	var objItem;
	var searchresult;
	for (var i = 0; i < activesetfiles.length; i++)
		{
		searchresult = settingFolder.getFiles(activesetfiles[i]);
		if (searchresult.length > 0) 
			{
			settingsItems.push(new Array(searchresult[0].parent.name, searchresult[0]));
			}
		}
	objItem = null;
	searchresult = null;
	return settingsItems;
}


/****************************************
 * getDirContents
 ****************************************/
function getDirContents(tmpFolderItems) {
    fileItems = new Array();
    getFiles(tmpFolderItems,fileItems);
    return fileItems.sort();
}
/****************************************
 * getFiles
 ****************************************/
function getFiles(tmpFolderItems) {

    var objItem;
    
    for (var i=0;i<tmpFolderItems.length;i++){
        objItem = tmpFolderItems[i];
        if (objItem instanceof Folder){
            objFolderName = objItem.name;
            getFiles(objItem.getFiles());
        } else if ( -1 != objItem.fsName.indexOf(".DS_Store")){
            continue;	// Skip Mac's hidden file
        } else {
           fileItems.push(new Array(objItem.parent.name,objItem));
        }
    }
    objItem = null;
}

/****************************************
 * getDirApp
 ****************************************/
function getDirApp(){
    /*
    The full path of the location of the Adobe Photoshop application.
    */
    return app.path;
}

/****************************************
 * getDirCommonFiles
 ****************************************/
function getDirCommonFiles(){
    /*
    In Windows, the value of %CommonProgramFiles% (by default, C:\\Program Files\\Common Files)
    In Mac OS, /Library/Application Support
    */
    return Folder.commonFiles;
}

/****************************************
 * getDirUserData
 ****************************************/
function getDirUserData(){
    /*
    In Windows, the value of %USERDATA% (by default, C:\\Documents and Settings\\ username \\Application Data) 
    In Mac OS, ~/Library/Application Support.
    */
    return Folder.userData;
}
/****************************************
 * getDirUserPreferencesMac
 ****************************************/
function getDirUserPreferencesMac(){
    /*
    In Windows, the value of %USERDATA% (by default, C:\\Documents and Settings\\ username \\Application Data) 
    In Mac OS, ~/Library/Application Support.
    */
    var tempUserData = decodeURI(Folder.userData).toString().replace("Application Support", "Preferences");
    return Folder(tempUserData);
}

/****************************************
 * alertScriptError
 ****************************************/
function alertScriptError(msg){
	alert(msg,"File Migration Error",true);
	errorToQuit++;
}

/****************************************
 * getCurOS
 ****************************************/
function getCurOS(curOS){
	try{
		var myOS;
		if(curOS.match("Macintosh")){
			myOS = "mac";
		}else if(curOS.match("XP")){
			myOS = "winxp";
		}else if(curOS.match("Vista")){
			myOS = "winvista";
		}else{
			myOS = "win7";
		}
		return myOS;
    }catch(e){
        alertScriptError("Line: " + $.line +" - "+ e);
    }
}
/****************************************
 * getAppVer
 ****************************************/
function getAppVer(){
	try{
        var curAppVer = app.version;
        var arrayAppVer = curAppVer.split("."); 
        return parseInt(arrayAppVer[0]);
    }catch(e){
        alertScriptError("Line: " + $.line +" - "+ e);
    }
}
