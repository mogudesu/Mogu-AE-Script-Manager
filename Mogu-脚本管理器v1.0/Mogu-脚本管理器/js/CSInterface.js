/*************************************************************************
* ADOBE CONFIDENTIAL
* ___________________
*
* Copyright 2013 Adobe
* All Rights Reserved.
*
* NOTICE: Adobe permits you to use, modify, and distribute this file in
* accordance with the terms of the Adobe license agreement accompanying
* it. If you have received this file from a source other than Adobe,
* then your use, modification, or distribution of it requires the prior
* written permission of Adobe.
**************************************************************************/

/**
 * @class CSInterface
 * This is the entry point to the CEP extensibility infrastructure.
 * Instantiate this object and use it to:
 * <ul>
 * <li>Access information about the host application in which an extension is running</li>
 * <li>Launch an extension</li>
 * <li>Register interest in event notifications, and dispatch events</li>
 * </ul>
 *
 * @return A new \c CSInterface object
 */
function CSInterface()
{
}

/**
 * User can add this event listener to handle native application theme color changes.
 * Callback function gives extensions ability to fine-tune their theme color after the user
 * changes the host application theme color and extension reloads.
 *
 * @example
 * // event listener for theme color changes.
 * csInterface.addEventListener(CSInterface.THEME_COLOR_CHANGED_EVENT, onAppThemeColorChanged);
 *
 * // event handler
 * function onAppThemeColorChanged(event)
 * {
 *    // Should get a latest HostEnvironment object from CSInterface.getHostEnvironment() then,
 *    // redraw the panel according to the new theme color.
 *
 *    var skinInfo = JSON.parse(window.__adobe_cep__.getHostEnvironment()).appSkinInfo;
 *    // Gets the style information such as color info from the skinInfo,
 *    // and redraw all UI controls of your extension according to the style info.
 * }
 */
CSInterface.THEME_COLOR_CHANGED_EVENT = "com.adobe.csxs.events.ThemeColorChanged";

/** The host environment data object. */
CSInterface.prototype.hostEnvironment = JSON.parse(window.__adobe_cep__.getHostEnvironment());

/**
 * Retrieves information about the host environment in which the
 * extension is currently running.
 *
 * @return A \c #HostEnvironment object.
 */
CSInterface.prototype.getHostEnvironment = function()
{
    this.hostEnvironment = JSON.parse(window.__adobe_cep__.getHostEnvironment());
    return this.hostEnvironment;
};

/** Closes this extension. */
CSInterface.prototype.closeExtension = function()
{
    window.__adobe_cep__.closeExtension();
};

/**
 * Retrieves a path for which a constant is defined in the system.
 *
 * @param pathType The path-type constant defined in \c #SystemPath ,
 *
 * @return The platform-specific system path string.
 */
CSInterface.prototype.getSystemPath = function(pathType)
{
    var path = decodeURI(window.__adobe_cep__.getSystemPath(pathType));
    var OSVersion = this.getOSInformation();
    if (OSVersion.indexOf("Windows") >= 0)
    {
      path = path.replace("file:///", "");
    }
    else if (OSVersion.indexOf("Mac") >= 0)
    {
      path = path.replace("file://", "");
    }
    return path;
};

/**
 * Evaluates a JavaScript script, which can use the JavaScript DOM
 * of the host application. The result is passed to the callback.
 *
 * @param script    The JavaScript script.
 * @param callback  Optional. A callback function that receives the result of evaluation.
 *                  If an error occurs, the callback function receives the error as an EvalScript_ErrMessage object.
 */
CSInterface.prototype.evalScript = function(script, callback)
{
    if (callback === null || callback === undefined)
    {
        callback = function(result) {};
    }
    window.__adobe_cep__.evalScript(script, callback);
};

/**
 * Retrieves the unique identifier of the application.
 * in which the extension is currently running.
 *
 * @return The unique ID string.
 */
CSInterface.prototype.getApplicationID = function()
{
    var appId = this.hostEnvironment.appId;
    return appId;
};

/**
 * Retrieves host capability information for the application
 * in which the extension is currently running.
 *
 * @return A \c #HostCapabilities object.
 */
CSInterface.prototype.getHostCapabilities = function()
{
    var hostCapabilities = JSON.parse(window.__adobe_cep__.getHostCapabilities());
    return hostCapabilities;
};

/**
 * Triggers a CEP event programmatically. Yoy can use it to dispatch
 * an event of a predefined type, or of a type you have defined.
 *
 * @param event A \c CSEvent object.
 */
CSInterface.prototype.dispatchEvent = function(event)
{
    if (typeof event.data == "object")
    {
        event.data = JSON.stringify(event.data);
    }

    window.__adobe_cep__.dispatchEvent(event);
};

/**
 * Registers an interest in a CEP event of a particular type, and
 * assigns an event handler.
 * The event infrastructure notifies your extension when events of this type occur,
 * passing the event object to the registered handler function.
 *
 * @param type     The name of the event type of interest.
 * @param listener The JavaScript handler function or method.
 * @param obj      Optional, the object containing the handler method, if any.
 *                 Default is null.
 */
CSInterface.prototype.addEventListener = function(type, listener, obj)
{
    window.__adobe_cep__.addEventListener(type, listener, obj);
};

/**
 * Removes a registered event listener.
 *
 * @param type      The name of the event type of interest.
 * @param listener  The JavaScript handler function or method that was registered.
 * @param obj       Optional, the object containing the handler method, if any.
 *                  Default is null.
 */
CSInterface.prototype.removeEventListener = function(type, listener, obj)
{
    window.__adobe_cep__.removeEventListener(type, listener, obj);
};

/**
 * Loads and launches another extension, or activates the extension if it is already loaded.
 *
 * @param extensionId       The extension's unique identifier.
 * @param startupParams     Not currently used, pass "".
 *
 * @example
 * To launch the extension "help" with ID "HLP001", call:
 * requestOpenExtension("HLP001", "");
 *
 */
CSInterface.prototype.requestOpenExtension = function(extensionId, params)
{
    window.__adobe_cep__.requestOpenExtension(extensionId, params);
};

/**
 * Retrieves the list of extensions currently loaded in the current host application.
 * The extension list is initialized once, and remains the same during the lifetime
 * of the CEP session.
 *
 * @param extensionIds  Optional, an array of unique identifiers for extensions of interest.
 *                      If omitted, retrieves data for all extensions.
 *
 * @return Zero or more \c #Extension objects.
 */
CSInterface.prototype.getExtensions = function(extensionIds)
{
    var extensionIdsStr = JSON.stringify(extensionIds);
    var extensionsStr = window.__adobe_cep__.getExtensions(extensionIdsStr);

    var extensions = JSON.parse(extensionsStr);
    return extensions;
};

/**
 * Retrieves network-related preferences.
 *
 * @return A JavaScript object containing network preferences.
 */
CSInterface.prototype.getNetworkPreferences = function()
{
    var result = window.__adobe_cep__.getNetworkPreferences();
    var networkPre = JSON.parse(result);

    return networkPre;
};

/**
 * Initializes the resource bundle for this extension with property values
 * for the current application and locale.
 * To support multiple locales, you must define a property file for each locale,
 * containing keyed display-string values for that locale.
 * See localization documentation for Extension Builder and related tools.
 *
 * Keys can be in the
 * form <code>key.value="localized string"</code>, for use in HTML text elements.
 * For example, in this input element:
 *
 *   <code><input type="submit" value="__LOCALIZE_Submit__"/></code>
 *
 * The key/value pair in the property file(s) should be:
 *
 *   <code>Submit="Submit"</code>
 *
 * @return An object containing the resource bundle information.
 */
CSInterface.prototype.initResourceBundle = function()
{
    var resourceBundle = JSON.parse(window.__adobe_cep__.initResourceBundle());
    var resElms = document.querySelectorAll('[data-locale]');
    for (var n = 0; n < resElms.length; n++)
    {
        var resEl = resElms[n];
        // Get the resource key from the element.
        var resKey = resEl.getAttribute('data-locale');
        if (resKey)
        {
            // Get all the resources that start with the key.
            for (var key in resourceBundle)
            {
                if (key.indexOf(resKey) === 0)
                {
                    var resValue = resourceBundle[key];
                    if (key.length == resKey.length)
                    {
                        resEl.innerHTML = resValue;
                    }
                    else if ('.' == key.charAt(resKey.length))
                    {
                        var attrKey = key.substring(resKey.length + 1);
                        resEl[attrKey] = resValue;
                    }
                }
            }
        }
    }
    return resourceBundle;
};

/**
 * Writes installation information to a file.
 *
 * @return The file path.
 */
CSInterface.prototype.dumpInstallationInfo = function()
{
    return window.__adobe_cep__.dumpInstallationInfo();
};

/**
 * Retrieves version information for the current Operating System,
 * See http://www.useragentstring.com/pages/Chrome/ for Chrome browser user agent strings.
 *
 * @return A string containing the OS version, or "unknown Operation System".
 * If user customizes the User Agent by setting CEF command parameter "--user-agent", only
 * "Mac OS X" or "Windows" will be returned.
 */
CSInterface.prototype.getOSInformation = function()
{
    var userAgent = navigator.userAgent;

    if ((navigator.platform == "Win32") || (navigator.platform == "Windows"))
    {
        var winVersion = "Windows platform";
        if (userAgent.indexOf("Windows NT 5.0") > -1)
        {
            winVersion = "Windows 2000";
        }
        else if (userAgent.indexOf("Windows NT 5.1") > -1)
        {
            winVersion = "Windows XP";
        }
        else if (userAgent.indexOf("Windows NT 5.2") > -1)
        {
            winVersion = "Windows Server 2003";
        }
        else if (userAgent.indexOf("Windows NT 6.0") > -1)
        {
            winVersion = "Windows Vista";
        }
        else if (userAgent.indexOf("Windows NT 6.1") > -1)
        {
            winVersion = "Windows 7";
        }
        else if (userAgent.indexOf("Windows NT 6.2") > -1)
        {
            winVersion = "Windows 8";
        }
        else if (userAgent.indexOf("Windows NT 6.3") > -1)
        {
            winVersion = "Windows 8.1";
        }
        else if (userAgent.indexOf("Windows NT 10") > -1)
        {
            winVersion = "Windows 10";
        }

        return winVersion;
    }
    else if ((navigator.platform == "MacIntel") || (navigator.platform == "Macintosh"))
    {
        var result = "Mac OS X";

        if (userAgent.indexOf("Mac OS X 10_5") > -1)
        {
            result = "Mac OS X 10.5";
        }
        else if (userAgent.indexOf("Mac OS X 10_6") > -1)
        {
            result = "Mac OS X 10.6";
        }
        else if (userAgent.indexOf("Mac OS X 10_7") > -1)
        {
            result = "Mac OS X 10.7";
        }
        else if (userAgent.indexOf("Mac OS X 10_8") > -1)
        {
            result = "Mac OS X 10.8";
        }
        else if (userAgent.indexOf("Mac OS X 10_9") > -1)
        {
            result = "Mac OS X 10.9";
        }
        else if (userAgent.indexOf("Mac OS X 10_10") > -1)
        {
            result = "Mac OS X 10.10";
        }
        else if (userAgent.indexOf("Mac OS X 10_11") > -1)
        {
            result = "Mac OS X 10.11";
        }
        else if (userAgent.indexOf("Mac OS X 10_12") > -1)
        {
            result = "Mac OS X 10.12";
        }
        else if (userAgent.indexOf("Mac OS X 10_13") > -1)
        {
            result = "Mac OS X 10.13";
        }
        else if (userAgent.indexOf("Mac OS X 10_14") > -1)
        {
            result = "Mac OS X 10.14";
        }
        else if (userAgent.indexOf("Mac OS X 10_15") > -1)
        {
            result = "Mac OS X 10.15";
        }

        return result;
    }

    return "Unknown Operation System";
};

/**
 * Opens a page in the default system browser.
 *
 * Since 4.2.0
 *
 * @param url  The URL of the page/file to open, or the email address.
 * Must use HTTP/HTTPS, file, or mailto protocol. For example:
 *   "http://www.adobe.com"
 *   "https://github.com"
 *   "file:///C:/log.txt"
 *   "mailto:test@adobe.com"
 *
 * @return One of these error codes:\n
 *      <ul>\n
 *          <li>NO_ERROR - 0</li>\n
 *          <li>ERR_UNKNOWN - 1</li>\n
 *          <li>ERR_INVALID_PARAMS - 2</li>\n
 *          <li>ERR_INVALID_URL - 201</li>\n
 *      </ul>\n
 */
CSInterface.prototype.openURLInDefaultBrowser = function(url)
{
    return cep.util.openURLInDefaultBrowser(url);
};

/**
 * Retrieves extension ID.
 *
 * Since 4.2.0
 *
 * @return extension ID.
 */
CSInterface.prototype.getExtensionID = function()
{
    return window.__adobe_cep__.getExtensionId();
};

/**
 * Retrieves the scale factor of screen.
 * On Windows platform, the value of scale factor might be different from operating system's scale factor,
 * since host application may use its self-defined scale factor.
 *
 * Since 4.2.0
 *
 * @return One of the following float number.\n
 *      <ul>\n
 *          <li>-1.0 when error occurs</li>\n
 *          <li>1.0 means normal screen</li>\n
 *          <li>2.0 means HiDPI screen</li>\n
 *      </ul>\n
 */
CSInterface.prototype.getScaleFactor = function()
{
    return window.__adobe_cep__.getScaleFactor();
};

/**
 * Set a handler to detect any changes of scale factor. This only works on Mac.
 *
 * Since 4.2.0
 *
 * @param handler   The function to be called when scale factor is changed.
 *
 */
CSInterface.prototype.setScaleFactorChangedHandler = function(handler)
{
    window.__adobe_cep__.setScaleFactorChangedHandler(handler);
};

/**
 * Retrieves current API version.
 *
 * Since 4.2.0
 *
 * @return ApiVersion object.
 *
 */
CSInterface.prototype.getCurrentApiVersion = function()
{
    return JSON.parse(window.__adobe_cep__.getCurrentApiVersion());
};

/**
 * Set panel flyout menu by an XML.
 *
 * Since 5.2.0
 *
 * Register a callback function for "com.adobe.csxs.events.flyoutMenuClicked" to get notified when a
 * menu item is clicked.
 * The "data" attribute of event is an object which contains "menuId" and "menuName" attributes.
 *
 * Register a callback function for "com.adobe.csxs.events.flyoutMenuOpened" to get notified when the
 * flyout menu is opened.
 *
 * Register a callback function for "com.adobe.csxs.events.flyoutMenuClosed" to get notified when the
 * flyout menu is closed.
 *
 * @param menu     A XML string which describes menu structure.
 * An example menu XML:
 * <Menu>
 *   <MenuItem Id="menuItemId1" Label="TestExample1" Enabled="true" Checked="false"/>
 *   <MenuItem Label="TestExample2">
 *     <MenuItem Id="menuItemId2" Label="TestExample2-1" Enabled="true" Checked="true"/>
 *     <MenuItem Id="menuItemId3" Label="TestExample2-2" Enabled="false" Checked="false"/>
 *   </MenuItem>
 *   <MenuItem Label="---" />
 *   <MenuItem Id="menuItemId4" Label="TestExample3" Enabled="true" Checked="false"/>
 * </Menu>
 *
 */
CSInterface.prototype.setPanelFlyoutMenu = function(menu)
{
    window.__adobe_cep__.invokeSync("setPanelFlyoutMenu", menu);
};

/**
 * Updates a menu item in the extension window's flyout menu, by setting the enabled
 * and selection status.
 *
 * Since 5.2.0
 *
 * @param menuItemLabel    The menu item label.
 * @param enabled        True to enable the item, false to disable it (gray it out).
 * @param checked        True to select the item, false to deselect it.
 *
 * @return false when the host application does not support this functionality (HostCapabilities.EXTENDED_PANEL_MENU is false).
 *         Fails silently if menu label is invalid.
 *
 * @see HostCapabilities.EXTENDED_PANEL_MENU
 */
CSInterface.prototype.updatePanelMenuItem = function(menuItemLabel, enabled, checked)
{
    var ret = false;
    if (this.getHostCapabilities().EXTENDED_PANEL_MENU)
    {
        var itemStatus = new MenuItemStatus(menuItemLabel, enabled, checked);
        ret = window.__adobe_cep__.invokeSync("updatePanelMenuItem", JSON.stringify(itemStatus));
    }
    return ret;
};

/**
 * Set context menu by XML string.
 *
 * Since 5.2.0
 *
 * There are a number of conventions used to communicate what type of menu item to create and how it should be handled.
 * - an item without menu ID or menu name is disabled and is not shown.
 * - if the menu item name is "---" (three hyphens) then it is treated as a separator. The menu ID in this case will always be NULL.
 * - Checkable attribute takes precedence over Checked attribute.
 * - a PNG icon. For optimal display results please supply a 16 x 16px icon as larger dimensions will increase the size of the menu item.
   The Chrome extension contextMenus API was taken as a reference.
   https://developer.chrome.com/extensions/contextMenus
 * - the items with icons and checkable items cannot coexist on the same menu level. The former take precedences over the latter.
 *
 * @param menu      A XML string which describes menu structure.
 * @param callback  The callback function which is called when a menu item is clicked. The only parameter is the returned ID of clicked menu item.
 *
 * @description An example menu XML:
 * <Menu>
 *   <MenuItem Id="menuItemId1" Label="TestExample1" Enabled="true" Checkable="true" Checked="false" Icon="./image/small_16X16.png"/>
 *   <MenuItem Id="menuItemId2" Label="TestExample2" Enabled="true" Checkable="true" Checked="true" Icon="./image/small_16X16.png"/>
 *   <MenuItem Label="---" />
 *   <MenuItem Id="menuItemId3" Label="TestExample3" Enabled="false" Checkable="true" Checked="false"/>
 * </Menu>
 */
CSInterface.prototype.setContextMenu = function(menu, callback)
{
    window.__adobe_cep__.invokeAsync("setContextMenu", menu, callback);
};

/**
 * Set context menu by JSON string.
 *
 * Since 6.0.0
 *
 * There are a number of conventions used to communicate what type of menu item to create and how it should be handled.
 * - an item without menu ID or menu name is disabled and is not shown.
 * - if the menu item name is "---" (three hyphens) then it is treated as a separator. The menu ID in this case will always be NULL.
 * - Checkable attribute takes precedence over Checked attribute.
 * - a PNG icon. For optimal display results please supply a 16 x 16px icon as larger dimensions will increase the size of the menu item.
   The Chrome extension contextMenus API was taken as a reference.
   https://developer.chrome.com/extensions/contextMenus
 * - the items with icons and checkable items cannot coexist on the same menu level. The former take precedences over the latter.
 *
 * @param menu      A JSON string which describes menu structure.
 * @param callback  The callback function which is called when a menu item is clicked. The only parameter is the returned ID of clicked menu item.
 *
 * @description An example menu JSON:
 *
 * {
 *      "menu": [
 *          {
 *              "id": "menuItemId1",
 *              "label": "testExample1",
 *              "enabled": true,
 *              "checkable": true,
 *              "checked": false,
 *              "icon": "./image/small_16X16.png"
 *          },
 *          {
 *              "id": "menuItemId2",
 *              "label": "testExample2",
 *              "enabled": true,
 *              "checkable": true,
 *              "checked": true,
 *              "icon": "./image/small_16X16.png"
 *          },
 *          {
 *              "label": "---"
 *          },
 *          {
 *              "id": "menuItemId3",
 *              "label": "testExample3",
 *              "enabled": false,
 *              "checkable": true,
 *              "checked": false
 *          }
 *      ]
 *  }
 *
 */
CSInterface.prototype.setContextMenuByJSON = function(menu, callback)
{
    window.__adobe_cep__.invokeAsync("setContextMenuByJSON", menu, callback);
};

/**
 * Updates a context menu item by setting the enabled and selection status.
 *
 * Since 5.2.0
 *
 * @param menuItemID    The menu item ID.
 * @param enabled       True to enable the item, false to disable it (gray it out).
 * @param checked       True to select the item, false to deselect it.
 */
CSInterface.prototype.updateContextMenuItem = function(menuItemID, enabled, checked)
{
    var itemStatus = new ContextMenuItemStatus(menuItemID, enabled, checked);
    ret = window.__adobe_cep__.invokeSync("updateContextMenuItem", JSON.stringify(itemStatus));
};

/**
 * Get the visibility status of an extension window.
 *
 * Since 6.0.0
 *
 * @return true if the extension window is visible; false if the extension window is hidden.
 */
CSInterface.prototype.isWindowVisible = function()
{
    return window.__adobe_cep__.invokeSync("isWindowVisible", "");
};

/**
 * Resize extension's content to the specified dimensions.
 * 1. Works with modal and modeless extensions in all Adobe products.
 * 2. Extension's manifest min/max size constraints apply and take precedence.
 * 3. For panel extensions
 *    3.1 This works in all Adobe products except:
 *        * Premiere Pro
 *        * Prelude
 *        * After Effects
 *    3.2 When the panel is in certain states (especially when being docked),
 *        it will not change to the desired dimensions even when the
 *        specified size satisfies min/max constraints.
 *
 * Since 6.0.0
 *
 * @param width  The new width
 * @param height The new height
 */
CSInterface.prototype.resizeContent = function(width, height)
{
    window.__adobe_cep__.resizeContent(width, height);
};

/**
 * Register the invalid certificate callback for network requests.
 * Since 7.0.0
 *
 * @param callback the callback function
 */
CSInterface.prototype.registerInvalidCertificateCallback = function(callback)
{
    return window.__adobe_cep__.registerInvalidCertificateCallback(callback);
};

/**
 * Register an interest in some key events to prevent them from being sent to the host application.
 *
 * This function works with modeless extensions and panel extensions.
 * Generally all the key events will be sent to the host application for these two extensions if the current focus is not on browser input element.
 * If you want to intercept some key events and want them to be handled in the extension, please call this function in advance to prevent them being sent to the host application.
 *
 * Since 8.0.0
 *
 * @param keyEventsInterest      A JSON string describing those key events you are interested in. A null object or an empty string will lead to removing the interest
 *
 * This JSON string should be an array, each object has following keys:
 *
 * "keyCode" - [Required] represents the key code;
 *
 * "ctrlKey" - [optional] a Boolean value indicating whether the control key was pressed (true) or not (false) when the event occurred.
 *
 * "altKey" - [optional] a Boolean value indicating whether the alt key was pressed (true) or not (false) when the event occurred.
 *
 * "shiftKey" - [optional] a Boolean value indicating whether the shift key was pressed (true) or not (false) when the event occurred.
 *
 * "metaKey" - [optional] (Mac Only) a Boolean value indicating whether the meta key was pressed (true) or not (false) when the event occurred.
 *                       On Macintosh keyboards, this is the command key. To detect Windows key on Windows, please use keyCode instead.
 *
 * "preventDefault" - [optional] a Boolean value indicating whether the event's default action should be prevented.
 *                                The default value is true.
 *
 * This function call will replace any previous interest.
 *
 * @example
 *
 * // register interest for "Ctrl + a" and "Ctrl + Shift + Z" key events
 * var keyEventsInterest = [
 *     {
 *         "keyCode": 65,
 *         "ctrlKey": true
 *     },
 *     {
 *         "keyCode": 90,
 *         "ctrlKey": true,
 *         "shiftKey": true
 *     }
 * ];
 * csInterface.registerKeyEventsInterest(JSON.stringify(keyEventsInterest));
 *
 * // remove interest in key events
 * csInterface.registerKeyEventsInterest("");
 *
 */
CSInterface.prototype.registerKeyEventsInterest = function(keyEventsInterest)
{
    return window.__adobe_cep__.registerKeyEventsInterest(keyEventsInterest);
};

/**
 * Set the title of the extension window.
 * This function works with modal and modeless extensions in all Adobe products, and panel extensions in Photoshop, InDesign, InCopy, Illustrator, Flash Pro and Dreamweaver.
 *
 * Since 8.0.0
 *
 * @param title The window title.
 */
CSInterface.prototype.setWindowTitle = function(title)
{
    window.__adobe_cep__.invokeSync("setWindowTitle", title);
};

/**
 * Get the title of the extension window.
 * This function works with modal and modeless extensions in all Adobe products, and panel extensions in Photoshop, InDesign, InCopy, Illustrator, Flash Pro and Dreamweaver.
 *
 * Since 8.0.0
 *
 * @return The window title.
 */
CSInterface.prototype.getWindowTitle = function()
{
    return window.__adobe_cep__.invokeSync("getWindowTitle", "");
};

//------------------------------ SystemPath object ------------------------------

/**
 * @class SystemPath
 * Stores operating-system-specific location constants for use in the
 * \c #CSInterface.getSystemPath() method.
 * @return A new \c SystemPath object.
 */
function SystemPath()
{

}

/** The path to user data.  */
SystemPath.USER_DATA = "userData";

/** The path to common files for Adobe applications.  */
SystemPath.COMMON_FILES = "commonFiles";

/** The path to the user's default document folder.  */
SystemPath.MY_DOCUMENTS = "myDocuments";

/** @deprecated. Use SystemPath.Extension.  */
SystemPath.APPLICATION = "application";

/** The path to current extension.  */
SystemPath.EXTENSION = "extension";

/** The path to hosting application's executable.  */
SystemPath.HOST_APPLICATION = "hostApplication";

//------------------------------ ColorType object ------------------------------

/**
 * @class ColorType
 * Stores color-type constants.
 */
function ColorType()
{

}

/** RGB color type. */
ColorType.RGB = "rbg";

/** Gradient color type. */
ColorType.GRADIENT = "gradient";

/** Null color type. */
ColorType.NONE = "none";

//------------------------------ RGBColor object ------------------------------

/**
 * @class RGBColor
 * Stores an RGB color with red, green, blue, and alpha values.
 * All values are in the range [0...255], with 0 being the
 * minimum value and 255 being the maximum value.
 * @param red   The red value, in the range [0...255], integer.
 * @param green The green value, in the range [0...255], integer.
 * @param blue  The blue value, in the range [0...255], integer.
 * @param alpha The alpha (transparency) value, in the range [0...255], integer.
 *              Optional, default is 255 (opaque).
 * @return A new RGBColor object.
 */
function RGBColor(red, green, blue, alpha)
{
    this.red = red;
    this.green = green;
    this.blue = blue;
    this.alpha = alpha;
}

/**
 * Converts this color specification to an integer.
 *
 * @return The color as a 0xRRGGBB integer.
 */
RGBColor.prototype.toNumber = function()
{
    return (this.red << 16) + (this.green << 8) + this.blue;
};

//------------------------------ Direction object ------------------------------

/**
 * @class Direction
 * A point value  in which the y component is 0 and the x component
 * is positive or negative for a right or left direction,
 * or the x component is 0 and the y component is positive or negative for
 * an up or down direction.
 * @param x     The horizontal component of the point.
 * @param y     The vertical component of the point.
 * @return A new \c Direction object.
 */
function Direction(x, y)
{
    this.x = x;
    this.y = y;
}

//------------------------------ GradientColor object ------------------------------

/**
 * @class GradientColor
 * Stores gradient color information.
 * @param type          The gradient type, must be "linear" or "radial".
 * @param direction     A Direction object for "linear" gradient,
 *                      for "radial" gradient, this is ignored.
 * @param numStops      The number of stops in the gradient.
 * @param gradientStopList   An array of GradientStop objects.
 * @return A new \c GradientColor object.
 */
function GradientColor(type, direction, numStops, arrGradientStop)
{
    this.type = type;
    this.direction = direction;
    this.numStops = numStops;
    this.arrGradientStop = arrGradientStop;
}

//------------------------------ GradientStop object ------------------------------

/**
 * @class GradientStop
 * Stores information about a single stop in a gradient.
 * @param offset   The offset of the stop, in the range [0...100].
 * @param rgbColor The color of the stop, an RGBColor object.
 * @return A new \c GradientStop object.
 */
function GradientStop(offset, rgbColor)
{
    this.offset = offset;
    this.rgbColor = rgbColor;
}

//------------------------------ UIColor object ------------------------------

/**
 * @class UIColor
 * Stores color information, including the type, anti-alias level, and specific color
 * values in a color object of an appropriate type.
 * @param type          The color type, 1 for "rgb" and 2 for "gradient".
 *                      The supplied color object must correspond to this type.
 * @param antialiasLevel    The anti-alias level constant.
 * @param color         A RGBColor or GradientColor object containing specific color information.
 * @return A new \c UIColor object.
 */
function UIColor(type, antialiasLevel, color)
{
    this.type = type;
    this.antialiasLevel = antialiasLevel;
    this.color = color;
}

//------------------------------ AppSkinInfo object ------------------------------

/**
 * @class AppSkinInfo
 * Stores window-skin properties, such as color and font. All color parameter values are UIColor objects except that systemHighlightColor is RGBColor object.
 * @param baseFontFamily        The base font family of the application.
 * @param baseFontSize          The base font size of the application.
 * @param appBarBackgroundColor     The application bar background color.
 * @param panelBackgroundColor      The background color of the extension panel.
 * @param appBarBackgroundColorSRGB     The application bar background color, as sRGB.
 * @param panelBackgroundColorSRGB      The background color of the extension panel, as sRGB.
 * @param systemHighlightColor          The operating-system highlight color, as sRGB.
 * @return A new \c AppSkinInfo object.
 */
function AppSkinInfo(baseFontFamily, baseFontSize, appBarBackgroundColor, panelBackgroundColor, appBarBackgroundColorSRGB, panelBackgroundColorSRGB, systemHighlightColor)
{
    this.baseFontFamily = baseFontFamily;
    this.baseFontSize = baseFontSize;
    this.appBarBackgroundColor = appBarBackgroundColor;
    this.panelBackgroundColor = panelBackgroundColor;
    this.appBarBackgroundColorSRGB = appBarBackgroundColorSRGB;
    this.panelBackgroundColorSRGB = panelBackgroundColorSRGB;
    this.systemHighlightColor = systemHighlightColor;
}

//------------------------------ HostEnvironment object ------------------------------

/**
 * @class HostEnvironment
 * Stores information about the environment in which the extension is loaded.
 * @param appName   The application's name.
 * @param appVersion    The application's version.
 * @param appLocale The application's current license locale.
 * @param appUILocale   The application's current UI locale.
 * @param appId     The application's unique identifier.
 * @param isAppOnline  True if the application is currently online.
 * @param appSkinInfo   An \c AppSkinInfo object containing the application's default color and font styles.
 * @return A new \c HostEnvironment object.
 */
function HostEnvironment(appName, appVersion, appLocale, appUILocale, appId, isAppOnline, appSkinInfo)
{
    this.appName = appName;
    this.appVersion = appVersion;
    this.appLocale = appLocale;
    this.appUILocale = appUILocale;
    this.appId = appId;
    this.isAppOnline = isAppOnline;
    this.appSkinInfo = appSkinInfo;
}

//------------------------------ HostCapabilities object ------------------------------

/**
 * @class HostCapabilities
 * Stores information about the host capabilities.
 * @param EXTENDED_PANEL_MENU True if the application supports panel menu.
 * @param EXTENDED_PANEL_ICONS True if the application supports panel icon.
 * @param DELEGATE_APE_ENGINE True if the application supports delegated APE engine.
 * @param SUPPORT_HTML_EXTENSIONS True if the application supports HTML extensions.
 * @param DISABLE_FLASH_EXTENSIONS True if the application disables FLASH extensions.
 * @return A new \c HostCapabilities object.
 */
function HostCapabilities(EXTENDED_PANEL_MENU, EXTENDED_PANEL_ICONS, DELEGATE_APE_ENGINE, SUPPORT_HTML_EXTENSIONS, DISABLE_FLASH_EXTENSIONS)
{
    this.EXTENDED_PANEL_MENU = EXTENDED_PANEL_MENU;
    this.EXTENDED_PANEL_ICONS = EXTENDED_PANEL_ICONS;
    this.DELEGATE_APE_ENGINE = DELEGATE_APE_ENGINE;
    this.SUPPORT_HTML_EXTENSIONS = SUPPORT_HTML_EXTENSIONS;
    this.DISABLE_FLASH_EXTENSIONS = DISABLE_FLASH_EXTENSIONS;
}

//------------------------------ ApiVersion object ------------------------------

/**
 * @class ApiVersion
 * Stores current api version.
 * Since 4.2.0
 * @param major  The major version
 * @param minor  The minor version.
 * @param micro  The micro version.
 * @return A new \c ApiVersion object.
 */
function ApiVersion(major, minor, micro)
{
    this.major = major;
    this.minor = minor;
    this.micro = micro;
}

//------------------------------ MenuItemStatus object ------------------------------

/**
 * @class MenuItemStatus
 * Stores flyout menu item status
 * Since 5.2.0
 * @param menuItemLabel  The menu item label.
 * @param enabled  True if user wants to enable the menu item.
 * @param checked  True if user wants to check the menu item.
 * @return A new \c MenuItemStatus object.
 */
function MenuItemStatus(menuItemLabel, enabled, checked)
{
    this.menuItemLabel = menuItemLabel;
    this.enabled = enabled;
    this.checked = checked;
}

//------------------------------ ContextMenuItemStatus object ------------------------------

/**
 * @class ContextMenuItemStatus
 * Stores the status of the context menu item.
 * Since 5.2.0
 * @param menuItemID     The menu item id.
 * @param enabled  True if user wants to enable the menu item.
 * @param checked  True if user wants to check the menu item.
 * @return A new \c ContextMenuItemStatus object.
 */
function ContextMenuItemStatus(menuItemID, enabled, checked)
{
    this.menuItemID = menuItemID;
    this.enabled = enabled;
    this.checked = checked;
}

//------------------------------ CSEvent object ------------------------------

/**
 * @class CSEvent
 * A standard JavaScript event, the base class for CEP events.
 * @param type              The name of the event type.
 * @param scope             The scope of event, can be "GLOBAL" or "APPLICATION".
 * @param appId             The unique identifier of the application that generated the event.
 * @param extensionId       The unique identifier of the extension that generated the event.
 * @return A new \c CSEvent object
 */
function CSEvent(type, scope, appId, extensionId)
{
    this.type = type;
    this.scope = scope;
    this.appId = appId;
    this.extensionId = extensionId;
    this.data = "";
}

/** Event-specific data. */
CSEvent.prototype.data = "";

//------------------------------ Extension object ------------------------------

/**
 * @class Extension
 * Encapsulates a CEP-based extension to an Adobe application.
 * @param id                The unique identifier of this extension.
 * @param name              The localizable display name of this extension.
 * @param mainPath          The path of the "index.html" file.
 * @param basePath          The base path of this extension.
 * @param windowType        The window type of this extension.
 *                          Valid values are "Panel", "Modeless" and "ModalDialog".
 * @param width             The default width in pixels of this extension.
 * @param height            The default height in pixels of this extension.
 * @param minWidth          The minimum width in pixels of this extension.
 * @param minHeight         The minimum height in pixels of this extension.
 * @param maxWidth          The maximum width in pixels of this extension.
 * @param maxHeight         The maximum height in pixels of this extension.
 * @param defaultExtensionDataXml The extension data in XML format.
 * @param specialExtensionDataXml The extension data in XML format for special cases.
 * @param requiredRuntimeList     An array of Runtime objects for this extension.
 * @param isAutoVisible     True if this extension is visible on loading.
 * @param isPluginExtension True if this extension is a plugin extension.
 * @return A new \c Extension object.
 */
function Extension(id, name, mainPath, basePath, windowType, width, height, minWidth, minHeight, maxWidth, maxHeight, defaultExtensionDataXml, specialExtensionDataXml, requiredRuntimeList, isAutoVisible, isPluginExtension)
{
    this.id = id;
    this.name = name;
    this.mainPath = mainPath;
    this.basePath = basePath;
    this.windowType = windowType;
    this.width = width;
    this.height = height;
    this.minWidth = minWidth;
    this.minHeight = minHeight;
    this.maxWidth = maxWidth;
    this.maxHeight = maxHeight;
    this.defaultExtensionDataXml = defaultExtensionDataXml;
    this.specialExtensionDataXml = specialExtensionDataXml;
    this.requiredRuntimeList = requiredRuntimeList;
    this.isAutoVisible = isAutoVisible;
    this.isPluginExtension = isPluginExtension;
}

//------------------------------ Runtime object ------------------------------

/**
 * @class Runtime
 * Represents a runtime related to the CEP infrastructure.
 * Extensions can declare dependencies on particular CEP runtime versions in the extension manifest.
 * @param name              The runtime name.
 * @param version           The runtime version.
 * @return A new \c Runtime object.
 */
function Runtime(name, version)
{
    this.name = name;
    this.version = version;
}

//------------------------------ Vulcan object ------------------------------

/**
 * @class Vulcan
 * Represents the Vulcan JavaScript engine, which can run ExtendScript code.
 * @return A new \c Vulcan object.
 */
function Vulcan()
{
}

/**
 * Gets the Vulcan JavaScript engine, which can run ExtendScript code.
 *
 * @return   A \c Vulcan object, or null if the Vulcan object is not available for this extension.
 */
Vulcan.prototype.getVulcanInterface = function()
{
    return window.__adobe_cep__.vulcanInterface;
};

/**
 * Gets the Vulcan JavaScript engine API version.
 *
 * @return   The version number of the Vulcan JavaScript engine.
 */
Vulcan.prototype.getVulcanAPIVersion = function()
{
    return window.__adobe_cep__.vulcanInterface.getAPIVersion();
};

/**
 * Checks whether the Vulcan JavaScript engine is currently available.
 *
 * @return   True if the Vulcan JavaScript engine is available, false otherwise.
 */
Vulcan.prototype.isVulcanAvailable = function()
{
    return (window.__adobe_cep__.vulcanInterface !== null && window.__adobe_cep__.vulcanInterface !== undefined);
};

/**
 * Logs a message to the Adobe CEP logger, which prints the log message to the stdout.
 * This is for extension debugging purposes, and is intended to be called from the extension.
 * For logging from ExtendScript, use the ExtendScript global function \c $.write().
 *
 * @param level     A string indicating the log level. Must be one of: "error", "warn", "info", or "debug".
 * @param message   A string containing the message to log.
 */
Vulcan.prototype.logMessage = function(level, message)
{
    window.__adobe_cep__.vulcanInterface.logMessage(level, message);
};

/**
 * Dispatches a Vulcan message to the ExtendScript side.
 *
 * @param vulcanMessage   The Vulcan message to dispatch.
 */
Vulcan.prototype.dispatchMessage = function(vulcanMessage)
{
    window.__adobe_cep__.vulcanInterface.dispatchMessage(vulcanMessage);
};

/**
 * Registers a message listener callback function for a Vulcan message.
 *
 * @param type            The message type.
 * @param callback        The callback function to register.
 * @param obj             Optional, the object containing the callback method, if any.
 *                        Default is null.
 */
Vulcan.prototype.addMessageListener = function(type, callback, obj)
{
    window.__adobe_cep__.vulcanInterface.addMessageListener(type, callback, obj);
};

/**
 * Removes a registered message listener callback function for a Vulcan message.
 *
 * @param type            The message type.
 * @param callback        The callback function to remove.
 * @param obj             Optional, the object containing the callback method, if any.
 *                        Default is null.
 */
Vulcan.prototype.removeMessageListener = function(type, callback, obj)
{
    window.__adobe_cep__.vulcanInterface.removeMessageListener(type, callback, obj);
};

/**
 * Gets all available fonts on the system.
 *
 * @return   The font list as an array of strings.
 */
Vulcan.prototype.getFontList = function()
{
    return JSON.parse(window.__adobe_cep__.vulcanInterface.getFontList());
};

/**
 * Gets the directory path of the extension.
 *
 * @return   The directory path of the extension.
 */
Vulcan.prototype.getExtensionRootDirectory = function()
{
    return window.__adobe_cep__.vulcanInterface.getExtensionRootDirectory();
};

/**
 * Gets the system directory path.
 *
 * @param pathType   The path type. Must be one of: "userData", "commonFiles", "myDocuments", "application", "extension", "hostApplication".
 *
 * @return   The directory path.
 */
Vulcan.prototype.getSystemPath = function(pathType)
{
    return window.__adobe_cep__.vulcanInterface.getSystemPath(pathType);
};

/**
 * Evaluates a JavaScript script, which can use the JavaScript DOM
 * of the host application. The result is passed to the callback.
 *
 * @param script    The JavaScript script.
 * @param callback  Optional. A callback function that receives the result of evaluation.
 *                  If an error occurs, the callback function receives the error as an EvalScript_ErrMessage object.
 */
Vulcan.prototype.evalScript = function(script, callback)
{
    return window.__adobe_cep__.vulcanInterface.evalScript(script, callback);
};

/**
 * Evaluates an ExtendScript script. The result is passed to the callback.
 *
 * @param script    The ExtendScript script.
 * @param callback  Optional. A callback function that receives the result of evaluation.
 *                  If an error occurs, the callback function receives the error as an EvalScript_ErrMessage object.
 */
Vulcan.prototype.evalExtendScript = function(script, callback)
{
    return window.__adobe_cep__.vulcanInterface.evalExtendScript(script, callback);
};

/**
 * Requires an ExtendScript script file.
 *
 * @param file      The file to require.
 */
Vulcan.prototype.requireExtendScript = function(file)
{
    return window.__adobe_cep__.vulcanInterface.requireExtendScript(file);
};

//------------------------------ VulcanMessage object ------------------------------

/**
 * @class VulcanMessage
 * Represents a message between the ExtendScript and JavaScript side.
 * @param type              The message type.
 * @param scope             The message scope that could be "global" or "local".
 * @param appId             The application ID.
 * @param extensionId       The extension ID.
 * @param data              The message data.
 * @return A new \c VulcanMessage object.
 */
function VulcanMessage(type, scope, appId, extensionId, data)
{
    this.type = type;
    this.scope = scope;
    this.appId = appId;
    this.extensionId = extensionId;
    this.data = data;
}

//------------------------------ VulcanUnit object ------------------------------

/**
 * @class VulcanUnit
 * Represents a Vulcan unit.
 * @param unitType          The unit type.
 * @param unitValue         The unit value.
 * @return A new \c VulcanUnit object.
 */
function VulcanUnit(unitType, unitValue)
{
    this.type = unitType;
    this.value = unitValue;
}

//------------------------------ AppearanceColorType object ------------------------------

/**
 * @class AppearanceColorType
 * Stores color-type constants.
 */
function AppearanceColorType()
{

}

/** Color of the panel background. */
AppearanceColorType.PANEL_BACKGROUND = "panelBackgroundColor";

/** Color of the active tab. */
AppearanceColorType.ACTIVE_TAB = "activeTabColor";

/** Color of the inactive tab. */
AppearanceColorType.INACTIVE_TAB = "inactiveTabColor";

/** Color of the tab border. */
AppearanceColorType.TAB_BORDER = "tabBorderColor";

/** Color of the active tab text. */
AppearanceColorType.ACTIVE_TAB_TEXT = "activeTabTextColor";

/** Color of the inactive tab text. */
AppearanceColorType.INACTIVE_TAB_TEXT = "inactiveTabTextColor";

/** Color of the panel border. */
AppearanceColorType.PANEL_BORDER = "panelBorderColor";

/** Color of the icon fill (dark). */
AppearanceColorType.ICON_FILL_DARK = "iconFillColor";

/** Color of the icon fill (light). */
AppearanceColorType.ICON_FILL_LIGHT = "iconFillColorLight";

/** Color of the icon fill (selected). */
AppearanceColorType.ICON_FILL_SELECTED = "iconFillColorSelected";

/** Color of the icon fill (rollover). */
AppearanceColorType.ICON_FILL_ROLLOVER = "iconFillColorRollover";

/** Color of the button fill. */
AppearanceColorType.BUTTON_FILL = "buttonFillColor";

/** Color of the button fill (rollover). */
AppearanceColorType.BUTTON_FILL_ROLLOVER = "buttonFillColorRollover";

/** Color of the button fill (pressed). */
AppearanceColorType.BUTTON_FILL_PRESSED = "buttonFillColorPressed";

/** Color of the button text. */
AppearanceColorType.BUTTON_TEXT = "buttonTextColor";

/** Color of the button text (rollover). */
AppearanceColorType.BUTTON_TEXT_ROLLOVER = "buttonTextColorRollover";

/** Color of the button text (pressed). */
AppearanceColorType.BUTTON_TEXT_PRESSED = "buttonTextColorPressed";

/** Color of the input idle. */
AppearanceColorType.INPUT_IDLE = "inputIdleColor";

/** Color of the input active. */
AppearanceColorType.INPUT_ACTIVE = "inputActiveColor";

/** Color of the input border. */
AppearanceColorType.INPUT_BORDER = "inputBorderColor";

/** Color of the input text. */
AppearanceColorType.INPUT_TEXT = "inputTextColor";

/** Color of the dropdown arrow. */
AppearanceColorType.DROPDOWN_ARROW = "dropdownArrowColor";

/** Color of the dropdown background. */
AppearanceColorType.DROPDOWN_BACKGROUND = "dropdownBackgroundColor";

/** Color of the dropdown border. */
AppearanceColorType.DROPDOWN_BORDER = "dropdownBorderColor";

/** Color of the dropdown item background (rollover). */
AppearanceColorType.DROPDOWN_ITEM_ROLLOVER = "dropdownItemRolloverColor";

/** Color of the dropdown item text. */
AppearanceColorType.DROPDOWN_ITEM_TEXT = "dropdownItemTextColor";

/** Color of the scrollbar thumb. */
AppearanceColorType.SCROLLBAR_THUMB = "scrollbarThumbColor";

/** Color of the scrollbar track. */
AppearanceColorType.SCROLLBAR_TRACK = "scrollbarTrackColor";

/** Color of the slider thumb. */
AppearanceColorType.SLIDER_THUMB = "sliderThumbColor";

/** Color of the slider track. */
AppearanceColorType.SLIDER_TRACK = "sliderTrackColor";

/** Color of the slider track fill. */
AppearanceColorType.SLIDER_TRACK_FILL = "sliderTrackFillColor";

/** Color of the progress bar. */
AppearanceColorType.PROGRESS_BAR = "progressBarColor";

/** Color of the progress bar track. */
AppearanceColorType.PROGRESS_BAR_TRACK = "progressBarTrackColor";

/** Color of the disclosure triangle. */
AppearanceColorType.DISCLOSURE_TRIANGLE = "disclosureTriangleColor";

/** Color of the list item background (odd). */
AppearanceColorType.LIST_ITEM_ODD = "listItemOddColor";

/** Color of the list item background (even). */
AppearanceColorType.LIST_ITEM_EVEN = "listItemEvenColor";

/** Color of the list item background (selected). */
AppearanceColorType.LIST_ITEM_SELECTED = "listItemSelectedColor";

/** Color of the list item text. */
AppearanceColorType.LIST_ITEM_TEXT = "listItemTextColor";

/** Color of the list item text (selected). */
AppearanceColorType.LIST_ITEM_TEXT_SELECTED = "listItemTextSelectedColor";

/** Color of the tree item background (odd). */
AppearanceColorType.TREE_ITEM_ODD = "treeItemOddColor";

/** Color of the tree item background (even). */
AppearanceColorType.TREE_ITEM_EVEN = "treeItemEvenColor";

/** Color of the tree item background (selected). */
AppearanceColorType.TREE_ITEM_SELECTED = "treeItemSelectedColor";

/** Color of the tree item text. */
AppearanceColorType.TREE_ITEM_TEXT = "treeItemTextColor";

/** Color of the tree item text (selected). */
AppearanceColorType.TREE_ITEM_TEXT_SELECTED = "treeItemTextSelectedColor";

/** Color of the tree disclosure triangle. */
AppearanceColorType.TREE_DISCLOSURE_TRIANGLE = "treeDisclosureTriangleColor";

/** Color of the tree disclosure triangle (selected). */
AppearanceColorType.TREE_DISCLOSURE_TRIANGLE_SELECTED = "treeDisclosureTriangleSelectedColor";

/** Color of the tree disclosure triangle (rollover). */
AppearanceColorType.TREE_DISCLOSURE_TRIANGLE_ROLLOVER = "treeDisclosureTriangleRolloverColor";

/** Color of the tree disclosure triangle (pressed). */
AppearanceColorType.TREE_DISCLOSURE_TRIANGLE_PRESSED = "treeDisclosureTrianglePressedColor";

/** Color of the tree disclosure triangle (open). */
AppearanceColorType.TREE_DISCLOSURE_TRIANGLE_OPEN = "treeDisclosureTriangleOpenColor";

/** Color of the tree disclosure triangle (open, selected). */
AppearanceColorType.TREE_DISCLOSURE_TRIANGLE_OPEN_SELECTED = "treeDisclosureTriangleOpenSelectedColor";

/** Color of the tree disclosure triangle (open, rollover). */
AppearanceColorType.TREE_DISCLOSURE_TRIANGLE_OPEN_ROLLOVER = "treeDisclosureTriangleOpenRolloverColor";

/** Color of the tree disclosure triangle (open, pressed). */
AppearanceColorType.TREE_DISCLOSURE_TRIANGLE_OPEN_PRESSED = "treeDisclosureTriangleOpenPressedColor";

/** Color of the tooltip background. */
AppearanceColorType.TOOLTIP_BACKGROUND = "tooltipBackgroundColor";

/** Color of the tooltip border. */
AppearanceColorType.TOOLTIP_BORDER = "tooltipBorderColor";

/** Color of the tooltip text. */
AppearanceColorType.TOOLTIP_TEXT = "tooltipTextColor";

/** Color of the warning icon. */
AppearanceColorType.WARNING_ICON = "warningIconColor";

/** Color of the error icon. */
AppearanceColorType.ERROR_ICON = "errorIconColor";

/** Color of the info icon. */
AppearanceColorType.INFO_ICON = "infoIconColor";

/** Color of the success icon. */
AppearanceColorType.SUCCESS_ICON = "successIconColor";

/** Color of the link text. */
AppearanceColorType.LINK_TEXT = "linkTextColor";

/** Color of the link text (visited). */
AppearanceColorType.LINK_TEXT_VISITED = "linkTextVisitedColor";

/** Color of the link text (rollover). */
AppearanceColorType.LINK_TEXT_ROLLOVER = "linkTextRolloverColor";

/** Color of the link text (pressed). */
AppearanceColorType.LINK_TEXT_PRESSED = "linkTextPressedColor";

/** Color of the text. */
AppearanceColorType.TEXT = "textColor";

/** Color of the text (disabled). */
AppearanceColorType.TEXT_DISABLED = "textDisabledColor";

/** Color of the text (selected). */
AppearanceColorType.TEXT_SELECTED = "textSelectedColor";